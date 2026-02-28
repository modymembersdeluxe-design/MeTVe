(function () {
    var API_BASE = "/api";
    var SOCKET_URL = "wss://example.invalid/metve";
    var DRAFT_KEY = "metve_channel_draft_v2";

    function byId(id) { return document.getElementById(id); }

    function logTo(targetId, message) {
        var el = byId(targetId);
        var line = new Date().toISOString() + " | " + message;
        if (el) { el.textContent = line + "\n" + el.textContent; }
    }

    function logEvent(message) { logTo("eventLog", message); }
    function logUpload(message) { logTo("uploadLog", message); }

    function setConnectionState(isConnected, text) {
        var el = byId("connState");
        if (!el) { return; }
        el.className = "status " + (isConnected ? "status-up" : "status-down");
        el.textContent = "API/Socket: " + text;
    }

    function randomId() { return "id-" + Math.random().toString(16).slice(2) + Date.now(); }
    function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

    function ApiClient(baseUrl) {
        this.baseUrl = baseUrl;
        this.defaultTimeoutMs = 12000;
        this.maxRetries = 4;
    }

    ApiClient.prototype.request = async function (path, options) {
        var attempt = 0;
        var backoff = 500;
        var opts = options || {};

        while (true) {
            var controller = new AbortController();
            var timeout = setTimeout(function () { controller.abort(); }, this.defaultTimeoutMs);

            try {
                var response = await fetch(this.baseUrl + path, {
                    method: opts.method || "GET",
                    headers: Object.assign({
                        "Content-Type": "application/json",
                        "X-Request-Id": randomId(),
                        "X-Idempotency-Key": opts.idempotencyKey || randomId()
                    }, opts.headers || {}),
                    body: opts.body ? JSON.stringify(opts.body) : undefined,
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    var retryable = response.status >= 500 || response.status === 429;
                    if (retryable && attempt < this.maxRetries) {
                        attempt += 1;
                        logEvent("API retry " + attempt + " for " + path + " (HTTP " + response.status + ")");
                        await wait(backoff);
                        backoff *= 2;
                        continue;
                    }
                    throw new Error("API error: " + response.status + " " + await response.text());
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

    function SocketManager(url) {
        this.url = url;
        this.socket = null;
        this.reconnectAttempt = 0;
        this.maxReconnectDelay = 30000;
        this.subscriptions = {};
        this.connecting = false;
    }

    SocketManager.prototype.connect = function () {
        if (this.connecting) { return; }
        this.connecting = true;
        var self = this;

        try {
            this.socket = new WebSocket(this.url);
        } catch (error) {
            this.connecting = false;
            this.scheduleReconnect("socket constructor failed");
            return;
        }

        this.socket.onopen = function () {
            self.connecting = false;
            self.reconnectAttempt = 0;
            setConnectionState(true, "Connected");
            logEvent("Socket connected.");
            self.resubscribeAll();
        };

        this.socket.onmessage = function (ev) {
            if (ev.data === "ping") {
                self.send({ type: "pong", ts: Date.now() });
                return;
            }
            logEvent("Socket event: " + ev.data);
        };

        this.socket.onerror = function () { logEvent("Socket error."); };

        this.socket.onclose = function () {
            self.connecting = false;
            setConnectionState(false, "Reconnecting");
            self.scheduleReconnect("socket closed");
        };
    };

    SocketManager.prototype.scheduleReconnect = function (reason) {
        this.reconnectAttempt += 1;
        var delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
        logEvent("Reconnect in " + delay + "ms due to " + reason + ".");
        var self = this;
        setTimeout(function () { self.connect(); }, delay);
    };

    SocketManager.prototype.reconnectNow = function () {
        if (this.socket) {
            try { this.socket.close(); } catch (error) { }
        }
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
        Object.keys(this.subscriptions).forEach(function (topic) {
            self.send({ type: "subscribe", topic: topic });
        });
    };

    SocketManager.prototype.send = function (payload) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) { return; }
        this.socket.send(JSON.stringify(payload));
    };

    function validateChannel(channel) {
        var errors = [];
        if (!channel.name || channel.name.trim().length < 3) { errors.push("Channel name must be at least 3 characters."); }
        if (!/^[a-z0-9\-]{3,64}$/.test(channel.slug || "")) { errors.push("Slug must be 3-64 chars: lowercase letters, numbers, hyphen."); }
        if (["public", "private", "premium"].indexOf(channel.mode) === -1) { errors.push("Invalid mode."); }
        if (["SD", "HD", "FHD", "UHD"].indexOf(channel.outputProfile) === -1) { errors.push("Invalid output profile."); }
        if (!channel.timezone || channel.timezone.length < 2) { errors.push("Timezone is required."); }
        return errors;
    }

    function ChannelManager(api) {
        this.api = api;
        this.lastChannelId = null;
        this.lastVersion = null;
    }

    ChannelManager.prototype.listChannels = async function () {
        var data = await this.api.request("/channels", { method: "GET", idempotencyKey: "list-channels" });
        return data.channels || [];
    };

    ChannelManager.prototype.createChannel = async function (channel) {
        var errors = validateChannel(channel);
        if (errors.length) { throw new Error(errors.join(" ")); }

        var result = await this.api.request("/channels", {
            method: "POST",
            body: channel,
            idempotencyKey: "create-" + channel.slug
        });

        this.lastChannelId = result.channelId;
        this.lastVersion = result.version || 1;
        return result;
    };

    ChannelManager.prototype.saveChannel = async function (channel) {
        var errors = validateChannel(channel);
        if (errors.length) { throw new Error(errors.join(" ")); }
        if (!this.lastChannelId) { throw new Error("Create or select a channel before save."); }

        var result = await this.api.request("/channels/" + this.lastChannelId, {
            method: "PUT",
            body: Object.assign({}, channel, { version: this.lastVersion }),
            headers: { "If-Match": String(this.lastVersion || 1) },
            idempotencyKey: "save-" + this.lastChannelId + "-" + (this.lastVersion || 1)
        });

        this.lastVersion = result.version || this.lastVersion;
        return result;
    };

    ChannelManager.prototype.cloneChannel = async function () {
        if (!this.lastChannelId) { throw new Error("Select a channel first."); }
        var result = await this.api.request("/channels/" + this.lastChannelId + "/clone", {
            method: "POST",
            idempotencyKey: "clone-" + this.lastChannelId + "-" + Date.now()
        });
        return result;
    };

    ChannelManager.prototype.archiveChannel = async function () {
        if (!this.lastChannelId) { throw new Error("Select a channel first."); }
        return await this.api.request("/channels/" + this.lastChannelId + "/archive", {
            method: "POST",
            idempotencyKey: "archive-" + this.lastChannelId + "-" + Date.now()
        });
    };

    function readChannelForm() {
        return {
            name: byId("channelName").value,
            slug: byId("channelSlug").value,
            mode: byId("channelMode").value,
            outputProfile: byId("outputProfile").value,
            timezone: byId("timezone").value,
            brandingTheme: byId("brandingTheme").value,
            language: byId("language").value,
            liveMode: byId("liveMode").value,
            primaryOutput: byId("primaryOutput").value,
            backupStudio: byId("backupStudio").value
        };
    }

    function writeChannelForm(channel) {
        byId("channelName").value = channel.name || "";
        byId("channelSlug").value = channel.slug || "";
        byId("channelMode").value = channel.mode || "public";
        byId("outputProfile").value = channel.outputProfile || "HD";
        byId("timezone").value = channel.timezone || "UTC";
        byId("brandingTheme").value = channel.brandingTheme || "Classic Cable";
        byId("language").value = channel.language || "en-US";
    }

    function setResult(msg, isError) {
        var el = byId("channelResult");
        if (!el) { return; }
        el.style.color = isError ? "#b30000" : "#084400";
        el.textContent = msg;
    }

    function saveDraft(channel) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(channel));
        logEvent("Local draft saved.");
    }

    function loadDraft() {
        var raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) { return null; }
        try { return JSON.parse(raw); } catch (error) { return null; }
    }

    function bindUploadArea() {
        var drop = byId("dropArea");
        var input = byId("mediaInput");
        if (!drop || !input) { return; }

        drop.addEventListener("dragover", function (ev) { ev.preventDefault(); drop.className = "drop-area drag"; });
        drop.addEventListener("dragleave", function () { drop.className = "drop-area"; });
        drop.addEventListener("drop", function (ev) {
            ev.preventDefault();
            drop.className = "drop-area";
            input.files = ev.dataTransfer.files;
            logUpload("Dropped " + input.files.length + " files.");
        });
    }

    async function simulateResumableUpload(files) {
        if (!files.length) {
            logUpload("No files selected.");
            return;
        }

        for (var i = 0; i < files.length; i += 1) {
            var file = files[i];
            logUpload("Queueing " + file.name + " (" + file.size + " bytes)");
            await wait(200);
            logUpload("Uploaded " + file.name + " with resume-token " + randomId());
        }
    }

    function fillChannelSelect(channels, channelManager) {
        var select = byId("channelSelect");
        select.innerHTML = "";

        channels.forEach(function (channel) {
            var option = document.createElement("option");
            option.value = channel.channelId;
            option.text = channel.name + " (" + channel.channelId + ")";
            option.dataset.version = channel.version || 1;
            option.dataset.slug = channel.slug || "";
            option.dataset.mode = channel.mode || "public";
            option.dataset.output = channel.outputProfile || "HD";
            option.dataset.timezone = channel.timezone || "UTC";
            select.appendChild(option);
        });

        select.onchange = function () {
            var picked = select.options[select.selectedIndex];
            if (!picked) { return; }
            channelManager.lastChannelId = picked.value;
            channelManager.lastVersion = Number(picked.dataset.version || 1);
            writeChannelForm({
                name: picked.text.replace(/\s*\(.+\)$/, ""),
                slug: picked.dataset.slug,
                mode: picked.dataset.mode,
                outputProfile: picked.dataset.output,
                timezone: picked.dataset.timezone
            });
            logEvent("Channel selected: " + channelManager.lastChannelId);
        };
    }

    var apiClient = new ApiClient(API_BASE);
    var channelManager = new ChannelManager(apiClient);
    var socketManager = new SocketManager(SOCKET_URL);

    socketManager.connect();
    socketManager.subscribe("channel-status");
    socketManager.subscribe("playout-events");
    socketManager.subscribe("alerts");

    bindUploadArea();

    var draft = loadDraft();
    if (draft) {
        writeChannelForm(draft);
        logEvent("Loaded local draft.");
    }

    byId("btnCreateChannel").addEventListener("click", async function () {
        try {
            var channel = readChannelForm();
            saveDraft(channel);
            var result = await channelManager.createChannel(channel);
            setResult("Channel created: " + result.channelId, false);
            logEvent("Channel created: " + result.channelId);
        } catch (error) {
            setResult(error.message, true);
            logEvent("Create failed: " + error.message);
        }
    });

    byId("btnSaveChannel").addEventListener("click", async function () {
        try {
            var channel = readChannelForm();
            saveDraft(channel);
            var result = await channelManager.saveChannel(channel);
            setResult("Channel saved at version " + result.version, false);
            logEvent("Channel saved, version " + result.version);
        } catch (error) {
            setResult(error.message, true);
            logEvent("Save failed: " + error.message);
        }
    });

    byId("btnLoadChannels").addEventListener("click", async function () {
        try {
            var channels = await channelManager.listChannels();
            fillChannelSelect(channels, channelManager);
            logEvent("Loaded " + channels.length + " channels.");
        } catch (error) {
            logEvent("Channel list failed: " + error.message);
        }
    });

    byId("btnCloneChannel").addEventListener("click", async function () {
        try {
            var result = await channelManager.cloneChannel();
            logEvent("Cloned channel to " + result.channelId);
        } catch (error) {
            logEvent("Clone failed: " + error.message);
        }
    });

    byId("btnArchiveChannel").addEventListener("click", async function () {
        try {
            await channelManager.archiveChannel();
            logEvent("Channel archived.");
        } catch (error) {
            logEvent("Archive failed: " + error.message);
        }
    });

    byId("btnDraftChannel").addEventListener("click", function () {
        saveDraft(readChannelForm());
        setResult("Local draft saved.", false);
    });

    byId("btnReconnect").addEventListener("click", function () {
        socketManager.reconnectNow();
        logEvent("Manual socket reconnect requested.");
    });

    byId("btnUploadMedia").addEventListener("click", async function () {
        await simulateResumableUpload(byId("mediaInput").files || []);
    });
})();
