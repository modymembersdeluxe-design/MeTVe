(function () {
    function byId(id) { return document.getElementById(id); }
    function safeParse(raw, fallback) { try { return JSON.parse(raw); } catch (e) { return fallback; } }
    function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
    function nowIso() { return new Date().toISOString(); }

    var cfg = window.MeTVeV2Config || {};
    var apiBase = cfg.apiBaseUrl || '';
    var socketUrl = cfg.socketUrl || '';

    var CH_KEY = 'metve_v2_channels';
    var SH_KEY = 'metve_v2_shows';
    var AD_KEY = 'metve_v2_ads';
    var AC_KEY = 'metve_v2_accounts';
    var SS_KEY = 'metve_v2_session';
    var GD_KEY = 'metve_v2_guide';

    var channels = safeParse(localStorage.getItem(CH_KEY), [
        { name: 'Retro Hits', desc: 'Classic music videos and dedications.', format: 'video-tv', visibility: 'public', version: 1 },
        { name: 'Chat Live', desc: 'Interactive SMS/chat television.', format: 'chat', visibility: 'public', version: 1 },
        { name: 'Movie Gold', desc: '24/7 movie blocks and promos.', format: 'video-tv', visibility: 'premium', version: 1 },
        { name: 'Ringtone Wave', desc: 'Mobile tones and music loops.', format: 'ringtone-tv', visibility: 'public', version: 1 },
        { name: 'Creator Mix', desc: 'Experimental and other interactive content.', format: 'other', visibility: 'public', version: 1 }
    ]);
    var shows = safeParse(localStorage.getItem(SH_KEY), []);
    var ads = safeParse(localStorage.getItem(AD_KEY), []);
    var accounts = safeParse(localStorage.getItem(AC_KEY), []);
    var session = safeParse(localStorage.getItem(SS_KEY), null);
    var guide = safeParse(localStorage.getItem(GD_KEY), [
        { channel: 'Retro Hits', program: 'Morning Classics', start: '08:00', zone: 'Local' },
        { channel: 'Movie Gold', program: 'Noon Cinema', start: '12:00', zone: 'UTC' }
    ]);

    var socketState = 'offline';
    var socket = null;

    function setText(id, text) {
        var el = byId(id);
        if (el) { el.innerHTML = text; }
    }

    function setApiState(state) { setText('v2ApiState', state); }
    function setSocketState(state) { socketState = state; setText('v2SocketState', state); }
    function setLastSave(text) { setText('v2LastSave', text); }

    function apiRequest(path, method, payload, timeoutMs) {
        if (!window.fetch || !apiBase) {
            return Promise.reject(new Error('API not configured'));
        }

        var headers = {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': 'v2-' + Date.now(),
            'X-Request-Id': 'v2-req-' + Math.floor(Math.random() * 1000000)
        };

        return new Promise(function (resolve, reject) {
            var done = false;
            var timer = window.setTimeout(function () {
                if (done) { return; }
                done = true;
                reject(new Error('API timeout'));
            }, timeoutMs || 9000);

            fetch(apiBase + path, {
                method: method,
                headers: headers,
                body: payload ? JSON.stringify(payload) : null
            }).then(function (res) {
                if (done) { return; }
                done = true;
                window.clearTimeout(timer);
                if (!res.ok) {
                    reject(new Error('API HTTP ' + res.status));
                    return;
                }
                res.json().then(resolve, function () { resolve({ ok: true }); });
            }).catch(function (err) {
                if (done) { return; }
                done = true;
                window.clearTimeout(timer);
                reject(err);
            });
        });
    }

    function connectSocket() {
        if (!socketUrl || !window.WebSocket) {
            setSocketState('offline');
            return;
        }
        try {
            socket = new WebSocket(socketUrl);
            setSocketState('connecting');
            socket.onopen = function () { setSocketState('connected'); };
            socket.onerror = function () { setSocketState('error'); };
            socket.onclose = function () {
                setSocketState('reconnecting');
                window.setTimeout(connectSocket, 2500);
            };
        } catch (e) {
            setSocketState('error');
        }
    }

    function renderChannels(list) {
        var wrap = byId('v2Channels');
        if (!wrap) { return; }
        wrap.innerHTML = '';
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            var card = document.createElement('div');
            card.className = 'v2-card';
            card.innerHTML = '<h4>' + c.name + '</h4><p>' + c.desc + '</p><div class="v2-tag">' + c.format + ' / ' + (c.visibility || 'public') + '</div>';
            wrap.appendChild(card);
        }
        setText('v2Count', String(list.length));
    }

    function renderShowsList(list) {
        var wrap = byId('v2Shows');
        if (!wrap) { return; }
        wrap.innerHTML = '';
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            var row = document.createElement('div');
            row.className = 'v2-row';
            row.innerHTML = '<strong>' + s.title + '</strong> <span>(' + s.type + ')</span> - ' + s.channel;
            wrap.appendChild(row);
        }
        setText('v2ShowCount', String(list.length));
    }

    function renderShows() {
        renderShowsList(shows);
    }

    function renderAuth() {
        if (session && session.username) {
            setText('v2AuthStatus', 'Signed In');
            setText('v2AuthUser', session.username);
        } else {
            setText('v2AuthStatus', 'Guest');
            setText('v2AuthUser', 'Not signed in');
        }
    }

    function renderGuide() {
        var wrap = byId('v2Guide');
        if (!wrap) { return; }
        wrap.innerHTML = '';
        for (var i = 0; i < guide.length; i++) {
            var g = guide[i];
            var row = document.createElement('div');
            row.className = 'v2-row';
            row.innerHTML = '<strong>' + g.start + ' ' + g.zone + '</strong> - ' + g.channel + ' : ' + g.program;
            wrap.appendChild(row);
        }
        setText('v2GuideCount', String(guide.length));
    }

    function renderAds() {
        var wrap = byId('v2Ads');
        if (!wrap) { return; }
        wrap.innerHTML = '';
        for (var i = 0; i < ads.length; i++) {
            var a = ads[i];
            var row = document.createElement('div');
            row.className = 'v2-row';
            row.innerHTML = '<strong>' + a.project + '</strong> - ' + a.message;
            wrap.appendChild(row);
        }
        setText('v2AdCount', String(ads.length));
    }

    function upsertLocalChannel(item) {
        var i;
        var idx = -1;
        for (i = 0; i < channels.length; i++) {
            if (channels[i].name.toLowerCase() === item.name.toLowerCase()) {
                idx = i;
                break;
            }
        }
        if (idx >= 0) {
            item.version = (channels[idx].version || 1) + 1;
            channels[idx] = item;
        } else {
            item.version = 1;
            channels.push(item);
        }
        save(CH_KEY, channels);
        renderChannels(channels);
    }

    function validateChannel(channel) {
        if (!channel.name || channel.name.length < 3) { return 'Channel name too short.'; }
        if (!channel.desc || channel.desc.length < 4) { return 'Description too short.'; }
        return '';
    }

    function addFolderBatch(prefix, type, count) {
        for (var i = 1; i <= count; i++) {
            shows.push({ title: prefix + ' ' + i, type: type, channel: 'Library' });
        }
        save(SH_KEY, shows);
        renderShows();
    }

    function bindEvents() {
        var signIn = byId('btnV2SignIn');
        if (signIn) {
            signIn.onclick = function () {
                var username = byId('v2LoginUser').value;
                var password = byId('v2LoginPass').value;
                var found = null;
                for (var i = 0; i < accounts.length; i++) {
                    if (accounts[i].username === username && accounts[i].password === password) { found = accounts[i]; break; }
                }
                if (!found) { setText('v2AuthResult', 'Invalid credentials.'); return; }
                session = { username: found.username, email: found.email || '' };
                save(SS_KEY, session);
                renderAuth();
                setText('v2AuthResult', 'Signed in as ' + found.username);
            };
        }

        var signUp = byId('btnV2SignUp');
        if (signUp) {
            signUp.onclick = function () {
                var username = byId('v2LoginUser').value;
                var password = byId('v2LoginPass').value;
                var email = byId('v2LoginEmail').value;
                if (!username || username.length < 3) { setText('v2AuthResult', 'Username too short.'); return; }
                if (!password || password.length < 4) { setText('v2AuthResult', 'Password too short.'); return; }
                for (var i = 0; i < accounts.length; i++) {
                    if (accounts[i].username === username) { setText('v2AuthResult', 'Username already exists.'); return; }
                }
                accounts.push({ username: username, password: password, email: email || '' });
                save(AC_KEY, accounts);
                setText('v2AuthResult', 'Account created. Please sign in.');
            };
        }

        var signOut = byId('btnV2SignOut');
        if (signOut) {
            signOut.onclick = function () {
                session = null;
                save(SS_KEY, session);
                renderAuth();
                setText('v2AuthResult', 'Signed out.');
            };
        }

        var addGuide = byId('btnV2AddGuide');
        if (addGuide) {
            addGuide.onclick = function () {
                var channel = byId('v2GuideChannel').value;
                var program = byId('v2GuideProgram').value;
                var start = byId('v2GuideStart').value;
                var zone = byId('v2GuideZone').value;
                if (!channel || !program || !start) { setText('v2GuideResult', 'Channel, program and start are required.'); return; }
                guide.push({ channel: channel, program: program, start: start, zone: zone });
                save(GD_KEY, guide);
                renderGuide();
                setText('v2GuideResult', 'Guide slot added for ' + channel);
            };
        }

        var createOrSave = byId('btnV2CreateChannel');
        if (createOrSave) {
            createOrSave.onclick = function () {
                var payload = {
                    name: byId('v2ChannelName').value,
                    desc: byId('v2ChannelDesc').value,
                    format: byId('v2ChannelFormat').value,
                    visibility: byId('v2ChannelVisibility').value,
                    updatedAt: nowIso()
                };
                var validation = validateChannel(payload);
                if (validation) {
                    setText('v2Result', validation);
                    return;
                }

                apiRequest('/api/channels', 'POST', payload, 9000).then(function (response) {
                    setApiState('online');
                    upsertLocalChannel(response && response.name ? response : payload);
                    setLastSave(nowIso());
                    setText('v2Result', 'Channel saved via API: ' + payload.name);
                }).catch(function () {
                    setApiState('offline (local fallback)');
                    upsertLocalChannel(payload);
                    setLastSave(nowIso() + ' (local)');
                    setText('v2Result', 'API unavailable. Saved locally: ' + payload.name);
                });
            };
        }

        var addShowsFolder = byId('btnV2AddShowsFolder');
        if (addShowsFolder) { addShowsFolder.onclick = function () { addFolderBatch('Show Folder Item', 'Show', 6); setText('v2ShowResult', 'Added Shows folder batch.'); }; }

        var addMoviesFolder = byId('btnV2AddMoviesFolder');
        if (addMoviesFolder) { addMoviesFolder.onclick = function () { addFolderBatch('Movie Folder Item', 'Movie', 4); setText('v2ShowResult', 'Added Movies folder batch.'); }; }

        var addCommercialsFolder = byId('btnV2AddCommercialsFolder');
        if (addCommercialsFolder) { addCommercialsFolder.onclick = function () { addFolderBatch('Commercial Folder Item', 'Commercial', 5); setText('v2ShowResult', 'Added Commercials folder batch.'); }; }

        var addBumpersMulti = byId('btnV2AddBumpersMulti');
        if (addBumpersMulti) { addBumpersMulti.onclick = function () { addFolderBatch('Bumper Multi Item', 'Bumper', 8); setText('v2ShowResult', 'Added Bumpers multi batch.'); }; }

        var addSongsFolder = byId('btnV2AddSongsFolder');
        if (addSongsFolder) { addSongsFolder.onclick = function () { addFolderBatch('Song Folder Item', 'Song', 6); setText('v2ShowResult', 'Added Songs folder batch.'); }; }

        var addSongsMulti = byId('btnV2AddSongsMulti');
        if (addSongsMulti) { addSongsMulti.onclick = function () { addFolderBatch('Song Multi Item', 'Song', 10); setText('v2ShowResult', 'Added Songs multi batch.'); }; }

        var addIdentsMulti = byId('btnV2AddIdentsMulti');
        if (addIdentsMulti) { addIdentsMulti.onclick = function () { addFolderBatch('Ident Multi Item', 'Ident', 6); setText('v2ShowResult', 'Added Idents multi batch.'); }; }

        var addPromosFolder = byId('btnV2AddPromosFolder');
        if (addPromosFolder) { addPromosFolder.onclick = function () { addFolderBatch('Promo Folder Item', 'Promo', 5); setText('v2ShowResult', 'Added Promos folder batch.'); }; }

        var addShow = byId('btnV2AddShow');
        if (addShow) {
            addShow.onclick = function () {
                var title = byId('v2ShowTitle').value;
                var type = byId('v2ShowType').value;
                var channel = byId('v2ShowChannel').value;
                if (!title || title.length < 2) { setText('v2ShowResult', 'Media title too short.'); return; }
                shows.push({ title: title, type: type, channel: channel || 'Unassigned' });
                save(SH_KEY, shows);
                renderShows();
                setText('v2ShowResult', 'Media added to library: ' + title);
            };
        }

        var publishAd = byId('btnV2PublishAd');
        if (publishAd) {
            publishAd.onclick = function () {
                var project = byId('v2AdProject').value;
                var message = byId('v2AdMessage').value;
                if (!project) { setText('v2AdResult', 'Project name required.'); return; }
                ads.push({ project: project, message: message || 'Watch now on MeTVe' });
                save(AD_KEY, ads);
                renderAds();
                setText('v2AdResult', 'Project promoted: ' + project);
            };
        }

        var search = byId('btnV2Search');
        if (search) {
            search.onclick = function () {
                var q = (byId('v2Search').value || '').toLowerCase();
                var filtered = [];
                for (var i = 0; i < channels.length; i++) {
                    var c = channels[i];
                    if (c.name.toLowerCase().indexOf(q) >= 0 || c.desc.toLowerCase().indexOf(q) >= 0 || c.format.toLowerCase().indexOf(q) >= 0) {
                        filtered.push(c);
                    }
                }
                renderChannels(filtered);
            };
        }

        var searchLibrary = byId('btnV2LibrarySearch');
        if (searchLibrary) {
            searchLibrary.onclick = function () {
                var q = (byId('v2LibrarySearch').value || '').toLowerCase();
                var filtered = [];
                for (var i = 0; i < shows.length; i++) {
                    var s = shows[i];
                    if (s.title.toLowerCase().indexOf(q) >= 0 || s.type.toLowerCase().indexOf(q) >= 0 || (s.channel || '').toLowerCase().indexOf(q) >= 0) {
                        filtered.push(s);
                    }
                }
                renderShowsList(filtered);
            };
        }

        var resetLibrary = byId('btnV2LibraryReset');
        if (resetLibrary) {
            resetLibrary.onclick = function () {
                renderShows();
                setText('v2ShowResult', 'Library reset to full list.');
            };
        }

        var reconnect = byId('btnV2ReconnectSocket');
        if (reconnect) {
            reconnect.onclick = function () {
                connectSocket();
                setText('v2HealthResult', 'Socket reconnect requested. Current state: ' + socketState);
            };
        }

        var health = byId('btnV2HealthCheck');
        if (health) {
            health.onclick = function () {
                apiRequest('/api/health', 'GET', null, 4000).then(function () {
                    setApiState('online');
                    setText('v2HealthResult', 'API health check passed. Socket state: ' + socketState);
                }).catch(function () {
                    setApiState('offline');
                    setText('v2HealthResult', 'API health check failed. Using local fallback. Socket state: ' + socketState);
                });
            };
        }
    }

    bindEvents();
    connectSocket();
    renderChannels(channels);
    renderShows();
    renderAds();
    renderAuth();
    renderGuide();
    setApiState(apiBase ? 'configured' : 'not configured');
    setLastSave('N/A');
})();
