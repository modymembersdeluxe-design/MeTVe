(function () {
    function byId(id) { return document.getElementById(id); }
    function log(id, msg) {
        var el = byId(id);
        if (!el) { return; }
        el.innerHTML = new Date().toISOString() + ' | ' + msg + '\n' + el.innerHTML;
    }

    function safeParse(raw, fallback) {
        try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    var KEY = 'metve_legacy_channels';
    var channels = safeParse(localStorage.getItem(KEY), []);

    function saveChannels() { localStorage.setItem(KEY, JSON.stringify(channels)); }

    function refreshList() {
        var sel = byId('channelSelect');
        if (!sel) { return; }
        sel.innerHTML = '';
        for (var i = 0; i < channels.length; i++) {
            var ch = channels[i];
            var opt = document.createElement('option');
            opt.value = ch.channelId;
            opt.text = ch.name + ' (' + ch.channelId + ')';
            sel.appendChild(opt);
        }
    }

    function readForm() {
        return {
            name: byId('channelName').value,
            slug: byId('channelSlug').value,
            mode: byId('channelMode').value,
            channelFormat: byId('channelFormat').value,
            outputProfile: byId('outputProfile').value,
            timezone: byId('timezone').value
        };
    }

    function setResult(id, msg, error) {
        var el = byId(id);
        if (!el) { return; }
        el.style.color = error ? '#b30000' : '#084400';
        el.innerHTML = msg;
    }


    function setMenuHint(msg) {
        var h = byId('menuHint');
        if (h) { h.innerHTML = msg; }
    }

    function wireLegacyMenu() {
        var items = document.querySelectorAll('.legacy-nav li');
        for (var i = 0; i < items.length; i++) {
            (function (li) {
                li.onclick = function () {
                    for (var j = 0; j < items.length; j++) { items[j].className = ''; }
                    li.className = 'active';
                    setMenuHint('Menu switched to: ' + li.innerHTML);
                };
            })(items[i]);
        }

        var links = ['menuNewChannel','menuGoLive','menuUpload','menuPromo','menuLogs'];
        for (var k = 0; k < links.length; k++) {
            var el = byId(links[k]);
            if (el) {
                el.onclick = function () { return false; };
            }
        }
        if (byId('menuGoLive')) {
            byId('menuGoLive').onclick = function () { byId('btnGoLiveFun').click(); return false; };
        }
        if (byId('menuPromo')) {
            byId('menuPromo').onclick = function () { byId('btnPublishProjectAd').click(); return false; };
        }
    }

    byId('connState').innerHTML = 'API/Socket: Legacy Offline Mode';

    byId('btnSignIn').onclick = function () {
        var email = byId('loginEmail').value || 'operator@local';
        byId('authState').innerHTML = 'Signed in: ' + email;
        setResult('authResult', 'Legacy sign-in complete.', false);
    };

    byId('btnCreateAccount').onclick = function () {
        setResult('authResult', 'Legacy account created.', false);
    };

    byId('btnSignOut').onclick = function () {
        byId('authState').innerHTML = 'Guest';
        setResult('authResult', 'Signed out.', false);
    };

    byId('btnCreateChannel').onclick = function () {
        var data = readForm();
        if (!data.name || data.name.length < 3) { setResult('channelResult', 'Name too short.', true); return; }
        if (!data.slug || data.slug.length < 3) { setResult('channelResult', 'Slug too short.', true); return; }
        data.channelId = 'legacy_' + new Date().getTime();
        data.version = 1;
        channels.push(data);
        saveChannels();
        refreshList();
        setResult('channelResult', 'Channel created: ' + data.channelId, false);
        byId('previewScreen').innerHTML = 'ON AIR: ' + data.name + ' | ' + data.channelFormat + ' | ' + data.outputProfile;
    };

    byId('btnSaveChannel').onclick = function () {
        var sel = byId('channelSelect');
        if (!sel.value) { setResult('channelResult', 'Select channel first.', true); return; }
        for (var i = 0; i < channels.length; i++) {
            if (channels[i].channelId === sel.value) {
                var data = readForm();
                data.channelId = channels[i].channelId;
                data.version = (channels[i].version || 1) + 1;
                channels[i] = data;
                saveChannels();
                setResult('channelResult', 'Channel saved v' + data.version, false);
                log('eventLog', 'Legacy save complete for ' + data.channelId);
                break;
            }
        }
        refreshList();
    };

    byId('btnLoadChannels').onclick = function () { refreshList(); log('eventLog', 'Loaded ' + channels.length + ' local channels.'); };
    byId('btnLibrarySearch').onclick = function () { log('searchLog', 'Legacy search: ' + (byId('librarySearch').value || '')); };
    byId('btnStartLive').onclick = function () { setResult('liveResult', 'Legacy live started.', false); };
    byId('btnSimRevenue').onclick = function () { log('revenueLog', 'Legacy revenue tick.'); };
    byId('btnQuizRound').onclick = function () { log('interactiveLog', 'Legacy quiz round completed.'); };
    byId('btnSceneChat').onclick = function () { log('controlLog', 'Legacy preset: CHAT.'); };
    byId('btnSceneClip').onclick = function () { log('controlLog', 'Legacy preset: CLIP.'); };
    byId('btnSceneAd').onclick = function () { log('controlLog', 'Legacy preset: AD.'); };

    wireLegacyMenu();
    setMenuHint('Home dashboard loaded.');
    refreshList();
})();
