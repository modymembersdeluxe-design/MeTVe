(function () {
    var API_BASE = (window.MeTVeConfig && window.MeTVeConfig.apiBase) || "/api";
    var SOCKET_URL = (window.MeTVeConfig && window.MeTVeConfig.socketUrl) || "";
    var DRAFT_KEY = "metve_channel_draft_v5";
    var AUTH_KEY = "metve_auth_session_v1";
    var LIBRARY_KEY = "metve_library_store_v1";
    var CHANNELS_KEY = "metve_channels_store_v1";

    function byId(id) { return document.getElementById(id); }
    function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
    function randomId() { return "id-" + Math.random().toString(16).slice(2) + Date.now(); }

    function logTo(id, message) {
        var el = byId(id);
        if (el) { el.textContent = new Date().toISOString() + " | " + message + "\n" + el.textContent; }
    }
    function logEvent(msg) { logTo("eventLog", msg); }
    function logUpload(msg) { logTo("uploadLog", msg); }
    function logSearch(msg) { logTo("searchLog", msg); }
    function logAlert(msg) { logTo("alertLog", msg); }

    function setConnectionState(ok, text) {
        var el = byId("connState");
        if (!el) { return; }
        el.className = "status " + (ok ? "status-up" : "status-down");
        el.textContent = "API/Socket: " + text;
    }

    function setResult(id, message, isError) {
        var el = byId(id);
        if (!el) { return; }
        el.style.color = isError ? "#b30000" : "#084400";
        el.textContent = message;
    }

    function safeJsonParse(raw, fallback) {
        try { return JSON.parse(raw); } catch (error) { return fallback; }
    }

    function ApiClient(baseUrl) {
        this.baseUrl = baseUrl;
        this.defaultTimeoutMs = 12000;
        this.maxRetries = 4;
        this.authToken = null;
    }

    ApiClient.prototype.setAuthToken = function (token) { this.authToken = token || null; };

    ApiClient.prototype.request = async function (path, options) {
        var opts = options || {};
        var attempt = 0;
        var backoff = 500;

        while (true) {
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, this.defaultTimeoutMs);
            var headers = Object.assign({
                "Content-Type": "application/json",
                "X-Request-Id": randomId(),
                "X-Idempotency-Key": opts.idempotencyKey || randomId()
            }, opts.headers || {});
            if (this.authToken) { headers.Authorization = "Bearer " + this.authToken; }

            try {
                var response = await fetch(this.baseUrl + path, {
                    method: opts.method || "GET",
                    headers: headers,
                    body: opts.body ? JSON.stringify(opts.body) : undefined,
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    var retryable = response.status >= 500 || response.status === 429;
                    if (retryable && attempt < this.maxRetries) {
                        attempt += 1;
                        logEvent("API retry " + attempt + " for " + path + " status " + response.status);
                        await wait(backoff);
                        backoff *= 2;
                        continue;
                    }
                    throw new Error("API error " + response.status + ": " + await response.text());
                }

                if (response.status === 204) { return {}; }
                return await response.json();
            } catch (error) {
                clearTimeout(timeout);
                if (attempt < this.maxRetries) {
                    attempt += 1;
                    logEvent("Network retry " + attempt + " for " + path + " due to " + error.message);
                    await wait(backoff);
                    backoff *= 2;
                    continue;
                }
                throw error;
            }
        }
    };

    function AuthManager(api) {
        this.api = api;
        this.session = null;
    }

    AuthManager.prototype.loadSession = function () {
        var raw = localStorage.getItem(AUTH_KEY);
        if (!raw) { return; }
        this.session = safeJsonParse(raw, null);
        if (!this.session) { localStorage.removeItem(AUTH_KEY); return; }
        this.api.setAuthToken(this.session.token);
        byId("authState").textContent = "Signed in: " + this.session.email;
    };

    AuthManager.prototype.signIn = async function (email, password, remember) {
        if (!email || !password) { throw new Error("Email and password required."); }
        var result;
        try {
            result = await this.api.request("/auth/signin", {
                method: "POST",
                body: { email: email, password: password },
                idempotencyKey: "signin-" + email
            });
        } catch (error) {
            result = { token: "demo-token", userId: "demo", email: email };
            logEvent("Auth endpoint unavailable; demo session activated.");
        }
        this.session = { token: result.token, email: result.email, userId: result.userId };
        this.api.setAuthToken(this.session.token);
        byId("authState").textContent = "Signed in: " + this.session.email;
        if (remember) { localStorage.setItem(AUTH_KEY, JSON.stringify(this.session)); }
        return this.session;
    };

    AuthManager.prototype.createAccount = async function (email, password) {
        if (!email || !password) { throw new Error("Email and password required."); }
        try {
            await this.api.request("/auth/signup", {
                method: "POST",
                body: { email: email, password: password },
                idempotencyKey: "signup-" + email
            });
        } catch (error) {
            logEvent("Signup endpoint unavailable; local create simulated.");
        }
    };

    AuthManager.prototype.signOut = function () {
        this.session = null;
        this.api.setAuthToken(null);
        localStorage.removeItem(AUTH_KEY);
        byId("authState").textContent = "Guest";
    };

    function SocketManager(url, authManager) {
        this.url = url;
        this.authManager = authManager;
        this.socket = null;
        this.connecting = false;
        this.reconnectAttempt = 0;
        this.maxReconnectDelay = 30000;
        this.subscriptions = {};
        this.offlineMode = !url;
    }

    SocketManager.prototype.connect = function () {
        if (this.offlineMode) {
            setConnectionState(false, "Offline (socket not configured)");
            logEvent("Socket disabled: set window.MeTVeConfig.socketUrl to enable realtime stream.");
            return;
        }
        if (this.connecting) { return; }
        this.connecting = true;

        var token = this.authManager.session ? this.authManager.session.token : "guest";
        var self = this;
        try {
            this.socket = new WebSocket(this.url + "?token=" + encodeURIComponent(token));
        } catch (error) {
            this.connecting = false;
            this.scheduleReconnect("constructor failure");
            return;
        }

        this.socket.onopen = function () {
            self.connecting = false;
            self.reconnectAttempt = 0;
            setConnectionState(true, "Connected");
            self.resubscribeAll();
            logEvent("Socket connected.");
        };
        this.socket.onmessage = function (ev) {
            if (ev.data === "ping") { self.send({ type: "pong", ts: Date.now() }); return; }
            logEvent("Socket event: " + ev.data);
        };
        this.socket.onerror = function () { logEvent("Socket error."); };
        this.socket.onclose = function () {
            self.connecting = false;
            setConnectionState(false, "Reconnecting");
            self.scheduleReconnect("socket close");
        };
    };

    SocketManager.prototype.scheduleReconnect = function (reason) {
        if (this.offlineMode) { return; }
        this.reconnectAttempt += 1;
        var delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
        logEvent("Reconnect in " + delay + "ms due to " + reason);
        var self = this;
        setTimeout(function () { self.connect(); }, delay);
    };

    SocketManager.prototype.reconnectNow = function () {
        if (this.offlineMode) {
            logEvent("Reconnect skipped: socket offline mode.");
            return;
        }
        if (this.socket) { try { this.socket.close(); } catch (error) { } }
        this.connecting = false;
        this.reconnectAttempt = 0;
        this.connect();
    };

    SocketManager.prototype.subscribe = function (topic) {
        this.subscriptions[topic] = true;
        this.send({ type: "subscribe", topic: topic });
    };
    SocketManager.prototype.resubscribeAll = function () {
        var self = this;
        Object.keys(this.subscriptions).forEach(function (topic) { self.send({ type: "subscribe", topic: topic }); });
    };
    SocketManager.prototype.send = function (payload) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) { return; }
        this.socket.send(JSON.stringify(payload));
    };

    function LibraryStore() {
        this.data = safeJsonParse(localStorage.getItem(LIBRARY_KEY), {
            shows: [], movies: [], commercials: [], bumpers: [], songs: [], idents: [], promos: [], graphics: []
        });
    }
    LibraryStore.prototype.save = function () { localStorage.setItem(LIBRARY_KEY, JSON.stringify(this.data)); };
    LibraryStore.prototype.addItem = function (folder, item) {
        if (!this.data[folder]) { this.data[folder] = []; }
        this.data[folder].push(item);
        this.save();
    };
    LibraryStore.prototype.search = function (term) {
        var q = String(term || "").toLowerCase();
        var results = [];
        Object.keys(this.data).forEach(function (folder) {
            (this.data[folder] || []).forEach(function (item) {
                if ((item.name || "").toLowerCase().indexOf(q) !== -1) { results.push(folder + ": " + item.name); }
            });
        }, this);
        return results;
    };

    function LocalChannelStore() {
        this.channels = safeJsonParse(localStorage.getItem(CHANNELS_KEY), []);
    }
    LocalChannelStore.prototype.save = function () { localStorage.setItem(CHANNELS_KEY, JSON.stringify(this.channels)); };
    LocalChannelStore.prototype.list = function () { return this.channels.slice(); };
    LocalChannelStore.prototype.create = function (channel) {
        var entity = Object.assign({}, channel, { channelId: "local_" + randomId(), version: 1, status: "created" });
        this.channels.push(entity);
        this.save();
        return entity;
    };
    LocalChannelStore.prototype.update = function (channelId, channel, expectedVersion) {
        var idx = this.channels.findIndex(function (c) { return c.channelId === channelId; });
        if (idx === -1) { throw new Error("Channel not found in local store."); }
        var current = this.channels[idx];
        if ((current.version || 1) !== expectedVersion) { throw new Error("Version conflict in local store."); }
        var next = Object.assign({}, current, channel, { version: expectedVersion + 1, status: "saved" });
        this.channels[idx] = next;
        this.save();
        return next;
    };

    function validateChannel(channel) {
        var errors = [];
        if (!channel.name || channel.name.trim().length < 3) { errors.push("Channel name must be at least 3 characters."); }
        if (!/^[a-z0-9\-]{3,64}$/.test(channel.slug || "")) { errors.push("Slug must be 3-64 lowercase letters/numbers/hyphen."); }
        if (["public", "private", "premium"].indexOf(channel.mode) === -1) { errors.push("Invalid channel mode."); }
        if (["all", "slide-tv", "video-tv", "radio-tv", "vip", "ringtone-tv", "chat", "games", "other"].indexOf(channel.channelFormat) === -1) { errors.push("Invalid channel format."); }
        if (["SD", "HD", "FHD", "UHD"].indexOf(channel.outputProfile) === -1) { errors.push("Invalid output profile."); }
        if (!channel.timezone) { errors.push("Timezone required."); }
        return errors;
    }

    function ChannelManager(api, fallbackStore) {
        this.api = api;
        this.fallbackStore = fallbackStore;
        this.lastChannelId = null;
        this.lastVersion = 1;
    }

    ChannelManager.prototype.listChannels = async function () {
        try {
            var data = await this.api.request("/channels", { method: "GET", idempotencyKey: "list-channels" });
            return data.channels || [];
        } catch (error) {
            logEvent("Using local channels due to API list failure.");
            return this.fallbackStore.list();
        }
    };

    ChannelManager.prototype.createChannel = async function (channel) {
        var errs = validateChannel(channel);
        if (errs.length) { throw new Error(errs.join(" ")); }
        try {
            var result = await this.api.request("/channels", {
                method: "POST",
                body: channel,
                idempotencyKey: "create-" + channel.slug
            });
            this.lastChannelId = result.channelId;
            this.lastVersion = result.version || 1;
            return result;
        } catch (error) {
            logEvent("Create API unavailable, saved to local store.");
            var local = this.fallbackStore.create(channel);
            this.lastChannelId = local.channelId;
            this.lastVersion = local.version;
            return local;
        }
    };

    ChannelManager.prototype.saveChannel = async function (channel) {
        var errs = validateChannel(channel);
        if (errs.length) { throw new Error(errs.join(" ")); }
        if (!this.lastChannelId) { throw new Error("Create/select channel first."); }

        try {
            var result = await this.api.request("/channels/" + this.lastChannelId, {
                method: "PUT",
                headers: { "If-Match": String(this.lastVersion) },
                body: Object.assign({}, channel, { version: this.lastVersion }),
                idempotencyKey: "save-" + this.lastChannelId + "-" + this.lastVersion
            });
            this.lastVersion = result.version || this.lastVersion;
            return result;
        } catch (error) {
            logEvent("Save API unavailable, using local channel save.");
            var local = this.fallbackStore.update(this.lastChannelId, channel, this.lastVersion);
            this.lastVersion = local.version;
            return local;
        }
    };

    ChannelManager.prototype.cloneChannel = async function () {
        if (!this.lastChannelId) { throw new Error("Select channel first."); }
        try {
            return await this.api.request("/channels/" + this.lastChannelId + "/clone", { method: "POST", idempotencyKey: "clone-" + this.lastChannelId + "-" + Date.now() });
        } catch (error) {
            var source = this.fallbackStore.list().find(function (c) { return c.channelId === this.lastChannelId; }, this);
            if (!source) { throw error; }
            var clone = this.fallbackStore.create(Object.assign({}, source, { name: source.name + " Clone", slug: source.slug + "-clone" }));
            logEvent("Clone API unavailable, cloned in local store.");
            return clone;
        }
    };

    ChannelManager.prototype.archiveChannel = async function () {
        if (!this.lastChannelId) { throw new Error("Select channel first."); }
        try {
            return await this.api.request("/channels/" + this.lastChannelId + "/archive", { method: "POST", idempotencyKey: "archive-" + this.lastChannelId + "-" + Date.now() });
        } catch (error) {
            logEvent("Archive API unavailable; marked archived in logs only.");
            return { channelId: this.lastChannelId, status: "archived" };
        }
    };

    function readChannelForm() {
        return {
            name: byId("channelName").value,
            slug: byId("channelSlug").value,
            mode: byId("channelMode").value,
            channelFormat: byId("channelFormat").value,
            outputProfile: byId("outputProfile").value,
            timezone: byId("timezone").value,
            brandingTheme: byId("brandingTheme").value,
            language: byId("language").value,
            liveMode: byId("liveMode").value,
            externalSources: byId("externalSources").value,
            tickerText: byId("tickerText").value
        };
    }

    function writeChannelForm(c) {
        byId("channelName").value = c.name || "";
        byId("channelSlug").value = c.slug || "";
        byId("channelMode").value = c.mode || "public";
        byId("channelFormat").value = c.channelFormat || "all";
        byId("outputProfile").value = c.outputProfile || "HD";
        byId("timezone").value = c.timezone || "UTC";
        byId("brandingTheme").value = c.brandingTheme || "Nostalgia VIP";
        byId("language").value = c.language || "en-US";
        byId("tickerText").value = c.tickerText || "Welcome to MeTVe";
    }

    function saveDraft(channel) { localStorage.setItem(DRAFT_KEY, JSON.stringify(channel)); }
    function loadDraft() { return safeJsonParse(localStorage.getItem(DRAFT_KEY), null); }

    function fillChannelSelect(channels, manager) {
        var select = byId("channelSelect");
        select.innerHTML = "";
        channels.forEach(function (ch) {
            var opt = document.createElement("option");
            opt.value = ch.channelId;
            opt.text = ch.name + " (" + ch.channelId + ")";
            opt.dataset.version = ch.version || 1;
            opt.dataset.slug = ch.slug || "";
            opt.dataset.mode = ch.mode || "public";
            opt.dataset.format = ch.channelFormat || "all";
            opt.dataset.output = ch.outputProfile || "HD";
            opt.dataset.timezone = ch.timezone || "UTC";
            select.appendChild(opt);
        });

        select.onchange = function () {
            var picked = select.options[select.selectedIndex];
            if (!picked) { return; }
            manager.lastChannelId = picked.value;
            manager.lastVersion = Number(picked.dataset.version || 1);
            writeChannelForm({
                name: picked.text.replace(/\s*\(.+\)$/, ""),
                slug: picked.dataset.slug,
                mode: picked.dataset.mode,
                channelFormat: picked.dataset.format,
                outputProfile: picked.dataset.output,
                timezone: picked.dataset.timezone
            });
            byId("previewScreen").textContent = "Preview loaded for " + picked.text;
        };
    }

    function bindUploadArea() {
        var drop = byId("dropArea");
        if (!drop) { return; }
        drop.addEventListener("dragover", function (ev) { ev.preventDefault(); drop.className = "drop-area drag"; });
        drop.addEventListener("dragleave", function () { drop.className = "drop-area"; });
        drop.addEventListener("drop", function (ev) {
            ev.preventDefault();
            drop.className = "drop-area";
            logUpload("Dropped " + ev.dataTransfer.files.length + " file(s).");
        });
    }

    async function simulateResumableUpload(files) {
        if (!files || !files.length) { logUpload("No files selected."); return; }
        for (var i = 0; i < files.length; i += 1) {
            var file = files[i];
            var chunks = Math.max(1, Math.ceil(file.size / (5 * 1024 * 1024)));
            logUpload("Start upload " + file.name + " in " + chunks + " chunk(s)");
            for (var c = 1; c <= chunks; c += 1) {
                await wait(100);
                logUpload("Chunk " + c + "/" + chunks + " uploaded for " + file.name);
            }
            logUpload("Completed upload " + file.name + " token " + randomId());
        }
    }

    var api = new ApiClient(API_BASE);
    var auth = new AuthManager(api);
    var fallbackChannels = new LocalChannelStore();
    var channels = new ChannelManager(api, fallbackChannels);
    var library = new LibraryStore();
    var sockets = new SocketManager(SOCKET_URL, auth);

    auth.loadSession();
    sockets.connect();
    sockets.subscribe("channel-status");
    sockets.subscribe("playout-events");
    sockets.subscribe("alerts");
    sockets.subscribe("audience-events");

    bindUploadArea();

    var draft = loadDraft();
    if (draft) {
        writeChannelForm(draft);
        logEvent("Draft loaded.");
    }

    document.querySelectorAll(".folder-btn").forEach(function (button) {
        button.addEventListener("click", function () {
            var folder = button.getAttribute("data-folder");
            var title = prompt("Add media item to " + folder + " folder:", "sample-" + folder + "-item");
            if (!title) { return; }
            library.addItem(folder, { name: title, createdAt: Date.now() });
            logUpload("Added " + title + " to " + folder + " folder");
        });
    });

    byId("btnLibrarySearch").addEventListener("click", function () {
        var results = library.search(byId("librarySearch").value);
        if (!results.length) { logSearch("No matches."); return; }
        results.slice(0, 20).forEach(function (line) { logSearch(line); });
    });

    byId("btnSignIn").addEventListener("click", async function () {
        try {
            var session = await auth.signIn(byId("loginEmail").value, byId("loginPassword").value, byId("rememberMe").checked);
            setResult("authResult", "Signed in as " + session.email, false);
            sockets.reconnectNow();
        } catch (error) {
            setResult("authResult", error.message, true);
        }
    });

    byId("btnCreateAccount").addEventListener("click", async function () {
        try {
            await auth.createAccount(byId("loginEmail").value, byId("loginPassword").value);
            setResult("authResult", "Account created. Sign in now.", false);
        } catch (error) {
            setResult("authResult", error.message, true);
        }
    });

    byId("btnSignOut").addEventListener("click", function () {
        auth.signOut();
        setResult("authResult", "Signed out.", false);
        sockets.reconnectNow();
    });

    byId("btnLoadChannels").addEventListener("click", async function () {
        var list = await channels.listChannels();
        fillChannelSelect(list, channels);
        logEvent("Loaded " + list.length + " channels.");
    });

    byId("btnCreateChannel").addEventListener("click", async function () {
        try {
            var data = readChannelForm();
            saveDraft(data);
            var result = await channels.createChannel(data);
            setResult("channelResult", "Channel created: " + result.channelId, false);
            byId("previewScreen").textContent = "ON AIR: " + data.name + " | " + data.channelFormat + " | " + data.outputProfile + " | TZ " + data.timezone;
        } catch (error) {
            setResult("channelResult", error.message, true);
        }
    });

    byId("btnSaveChannel").addEventListener("click", async function () {
        try {
            var data = readChannelForm();
            saveDraft(data);
            var result = await channels.saveChannel(data);
            setResult("channelResult", "Channel saved. Version " + result.version, false);
        } catch (error) {
            setResult("channelResult", error.message, true);
        }
    });

    byId("btnCloneChannel").addEventListener("click", async function () {
        try {
            var result = await channels.cloneChannel();
            logEvent("Cloned channel to " + (result.channelId || "new"));
        } catch (error) {
            logEvent("Clone failed: " + error.message);
        }
    });

    byId("btnArchiveChannel").addEventListener("click", async function () {
        try {
            var result = await channels.archiveChannel();
            logEvent("Channel archived: " + result.channelId);
        } catch (error) {
            logEvent("Archive failed: " + error.message);
        }
    });

    byId("btnDraftChannel").addEventListener("click", function () {
        saveDraft(readChannelForm());
        setResult("channelResult", "Draft saved locally.", false);
    });

    byId("btnReconnect").addEventListener("click", function () {
        sockets.reconnectNow();
        logEvent("Manual reconnect requested.");
    });

    byId("btnUploadMedia").addEventListener("click", async function () {
        await simulateResumableUpload(byId("mediaInput").files || []);
    });


    byId("btnStartLive").addEventListener("click", function () {
        var profile = byId("outputProfile").value;
        var outputs = byId("liveOutputs").value;
        setResult("liveResult", "Live broadcast started (" + byId("channelFormat").value + " / " + profile + ") => " + outputs, false);
        byId("liveAnalytics").textContent = "Viewers: " + Math.floor(Math.random() * 200 + 20) + "\nAvg Watch: " + Math.floor(Math.random() * 25 + 3) + "m\nBitrate: " + byId("bitrateLadder").value;
        logEvent("Live stream started: " + outputs + " | " + byId("multiPlatform").value);
    });

    byId("btnPublishProjectAd").addEventListener("click", function () {
        var payload = {
            project: byId("adProjectName").value,
            link: byId("adProjectLink").value,
            message: byId("adProjectMessage").value
        };
        setResult("adResult", "Project ad published: " + payload.project, false);
        logEvent("Ad board update => " + payload.project + " | " + payload.link);
    });

    byId("btnSimulateAlert").addEventListener("click", function () {
        logAlert("Smart alert: filler block inserted (free slot detected).");
        logAlert("Smart alert: schedule clash between Movie Block A and Promo B.");
    });
})();
