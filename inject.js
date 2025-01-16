// firefox version of https://github.com/toluschr/RedNote-Comment-Translate



(function main() {
    function ReplaceNode(a, b) {
        a.parentNode.appendChild(b);
        a.parentNode.removeChild(a);
    }

    function TranslateButton_SetState() {
        this.style.cursor = 'pointer';
        if (this._ntext.parentNode !== null) {
            // this._ntext.parentNode.parentNode.querySelector('#less').click();
            ReplaceNode(this._ntext, this._otext);
            this.innerHTML = translate_icon();
        } else {
            // this._otext.parentNode.parentNode.querySelector('#less').click();
            ReplaceNode(this._otext, this._ntext);
            this.innerHTML = UNDO_ICON;
        }
    }

    function TranslateButton_Translate() {
        this.onclick = TranslateButton_SetState;
        this.style.cursor = "wait";

        let tmp = document.createElement("div");
        tmp.innerHTML = this._otext.innerHTML;

        /** @type {NodeListOf<HTMLImageElement>} */
        const images = tmp.querySelectorAll('img.yt-core-image');
        let emojiToImage = new Map();
        for (const img of images) {
            // convert emoji url to emoji symbol

            const match = img.src.match(/\/emoji_u([0-9a-fA-F]+)\./);
            if (match && match.length == 2) {
                const emoji = String.fromCodePoint(parseInt(match[1], 16));
                emojiToImage.set(emoji, (img.parentElement ?? img).outerHTML);
                img.after(emoji);
                img.remove();
            }

        }

        const anchors = tmp.querySelectorAll(QS_YT_LINK);

        console.log("translate: " + tmp.innerText);

        fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${TARGET}&dt=t&dj=1&q=${encodeURIComponent(tmp.innerText)}`)
            .then(response => response.json()).then(json => {
                console.log("translated: " + json);

                for (const sentence of json.sentences) {
                    const line = sentence.trans.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    this._ntext.innerHTML += line;
                }
                for (const anchor of anchors) {
                    if (TIME_REGEX.test(anchor.innerText)) {
                        // timestamp anchor
                        anchor.classList.add("timestamp-link");

                    } else if (anchor.href === '') {
                        anchor.href = (anchor.innerText.startsWith('http') ? '' : 'https://') + anchor.innerText;
                    }
                    this._ntext.innerHTML = this._ntext.innerHTML.replace(anchor.innerText, anchor.outerHTML);

                }

                for (const [emoji, img] of emojiToImage) {
                    this._ntext.innerHTML = this._ntext.innerHTML.replace(new RegExp(emoji, 'g'), img);
                }


                const videoPlayer = document.querySelector('#movie_player video');
                for (const timestampAnchor of this._ntext.querySelectorAll('.timestamp-link')) {
                    timestampAnchor.onclick = (e) => {
                        e.preventDefault();
                        videoPlayer.currentTime = parseInt(timestampAnchor.href.split('&t=').pop());
                        videoPlayer.play();
                        videoPlayer.scrollIntoView({ behavior: 'smooth' });

                    };
                }

                this.onclick();

            }).catch(error => {
                console.error('Translate Request error:', error);
            });
    }

    function ResetTranslateButton(tb) {
        if (tb._ntext.parentNode !== null) ReplaceNode(tb._ntext, tb._otext);

        tb._ntext.innerText = "";
        tb.innerHTML = translate_icon();
        tb.onclick = TranslateButton_Translate;

        if (autoTranslate) {
            buttonObserver.observe(tb);
        }

    }

    function TranslateButton(main) {
        let tb = document.createElement("a");
        tb.id = "translate-btn";
        tb.classList = "yt-simple-endpoint style-scope yt-formatted-string";
        console.log(`Original Text: ${main.querySelector(QS_CONTENT_TEXT)}`);
        tb._otext = main.querySelector(QS_CONTENT_TEXT);

        tb._ntext = document.createElement("div");
        tb._ntext.style.whiteSpace = "pre-wrap";
        tb._ntext.id = "content-text";
        tb._ntext.classList = "style-scope ytd-comment-renderer yt-formatted-string";

        ResetTranslateButton(tb);
        return tb;
    }

    async function handleButtonIntersection(entries, observer) {
        for (const entry of entries) {
            const button = entry.target;
            if (button.firstChild.className === 'undo-icon') continue;

            if (entry.isIntersecting) {
                await delay(30 + (Math.random() * 10));
                button.click();
                buttonObserver.unobserve(button);
            }
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function addAutoTranslateButton(parent, isShort = false) {
        autoTranslate = false;
        const btnSize = isShort ? 'xs' : 'm';
        const html = `
            <div style="margin-left: auto; margin-right: 5px">
                <button class="auto-translate-btn yt-spec-button-shape-next yt-spec-button-shape-next--filled yt-spec-button-shape-next--call-to-action yt-spec-button-shape-next--size-${btnSize}">
                    ${autoTranslateButtonText()}
                </button>
            </div>
        `;
        if (isShort) parent.querySelector('#menu').insertAdjacentHTML('beforebegin', html);
        else parent.insertAdjacentHTML('beforeend', html);

        const autoTranslateButtons = document.querySelectorAll('.auto-translate-btn');

        for (const btn of autoTranslateButtons) {
            btn.onclick = () => {
                autoTranslate = !autoTranslate;

                btn.innerText = autoTranslateButtonText();
                if (autoTranslate) {
                    for (const translateBtn of document.querySelectorAll(QS_TRANSLATE_BUTTON)) {
                        buttonObserver.observe(translateBtn);
                    }
                } else {
                    buttonObserver.disconnect();
                    for (const el of document.querySelectorAll('.undo-icon')) { el.click(); }
                }
            };
        }


    }

    function autoTranslateButtonText() {
        return `${autoTranslate ? 'Disable' : 'Enable'} Auto Translation`;
    }

    function resetAutoTranslation() {
        autoTranslate = false;
        let buttons = document.querySelectorAll('.auto-translate-btn');
        for (const btn of buttons) {
            btn.innerHTML = autoTranslateButtonText();
        }
        buttonObserver.disconnect();
    }

    function updateUI(commentParent) {
        const nodes = commentParent.querySelectorAll('.parent-comment');
        for (let n of nodes) {
            let main = n.querySelector(".comment-inner-container");
            console.log(main);
            if (!main) continue;
            let tb = main.querySelector(QS_TRANSLATE_BUTTON);
            if (tb != null) {
                console.log("Resetting translate button");
                ResetTranslateButton(tb);
            } else {
                console.log("Injecting translate button");
                let newTranslateButton = main.querySelector('.translate-button');
                if (newTranslateButton != null) {
                    console.log("Removing old translate button");
                    newTranslateButton.style.display = 'none';
                }

                main.querySelector(QS_BUTTON_CONTAINER).appendChild(TranslateButton(main));
            }
        }

        const replyNodes = commentParent.querySelectorAll('.comment-item');
        for (let n of replyNodes) {
            let main = n.querySelector(".comment-inner-container");
            console.log(main);
            if (!main) continue;
            let tb = main.querySelector(QS_TRANSLATE_BUTTON);
            if (tb != null) {
                console.log("Resetting translate button");
                ResetTranslateButton(tb);
            } else {
                console.log("Injecting translate button");
                let newTranslateButton = main.querySelector('.translate-button');
                if (newTranslateButton != null) {
                    console.log("Removing old translate button");
                    newTranslateButton.style.display = 'none';
                }

                main.querySelector(QS_BUTTON_CONTAINER).appendChild(TranslateButton(main));
            }
        }
    }

    /* Query Selectors */
    // From main
    const QS_TRANSLATE_BUTTON = ".author-wrapper>.author>#translate-btn";
    const QS_CONTENT_TEXT = ".content>.note-text";
    const QS_BUTTON_CONTAINER = ".author-wrapper>.author";
    const QS_YT_LINK = 'a.yt-simple-endpoint,a.yt-core-attributed-string__link';
    const TIME_REGEX = /^(?:(\d{1,2}):)?([0-5]?[0-9]):([0-5][0-9])$/;
    /* User settings */
    var TARGET = getDefaultLanguage();

    getBrowser().storage.local.get(storage_key).then((obj) => {
        if (obj.hasOwnProperty(storage_key)) {
            TARGET = obj[storage_key];
        }
    });

    getBrowser().storage.onChanged.addListener(function (obj) {
        if (obj.hasOwnProperty(storage_key) && obj[storage_key].hasOwnProperty('newValue')) {

            TARGET = obj[storage_key].newValue;
            buttonObserver.disconnect();
            // undo all translated text
            for (const el of document.querySelectorAll('.undo-icon')) { el.click(); }
            // remove all icons
            for (const el of document.querySelectorAll(QS_TRANSLATE_BUTTON)) { el.remove(); }
            // reinject 
            for (const el of document.querySelectorAll('.list-container>.parent-comment')) {
                el.querySelector(QS_BUTTON_CONTAINER).appendChild(TranslateButton(el));
            }

        }
    });

    const languageName = new Intl.DisplayNames(['en'], { type: 'language' });

    var translate_text = () => { return "Translate to " + languageName.of(TARGET); };
    var translate_icon = () => { return `<img src="${getBrowser().runtime.getURL('icons/translate.png')}" alt="${translate_text()}" title="${translate_text()}" width="16" height="16">`; };
    var UNDO_ICON = `<img src="${getBrowser().runtime.getURL('icons/undo.png')}" class="undo-icon" alt="Undo" title="Undo" width="16" height="16">`;

    var buttonObserver = new IntersectionObserver(handleButtonIntersection, { root: null, rootMargin: '0px', threshold: 0 });
    var autoTranslate = false;

    document.addEventListener("yt-navigate-finish", () => resetAutoTranslation());
    document.addEventListener("yt-navigate", () => resetAutoTranslation());
    //document.addEventListener("DOMContentLoaded", () => resetAutoTranslation());


    inject();

    /* Functions */
    // Inject as soon as the comment section was loaded
    function inject() {
        console.log("Injecting RedNote-Comment-Translate");
        const observerConfig = { childList: true, subtree: true };
        const commentObserver = new MutationObserver(e => {
            for (let mut of e) {
                console.log("load as addinational" + mut.target.classList);
                if (mut.target.classList.contains("list-container")) {
                    updateUI(mut.target);
                }

                if (mut.target.nodeName === 'YTD-COMMENTS-HEADER-RENDERER' && window.location.pathname.startsWith('/watch')) {
                    addAutoTranslateButton(mut.target.querySelector('#title'));
                } else if (mut.target.nodeName === 'YTD-ENGAGEMENT-PANEL-TITLE-HEADER-RENDERER' && window.location.pathname.startsWith('/shorts')) { // for shorts
                    addAutoTranslateButton(mut.target.querySelector('#header'), true);
                }
            }
        });

        commentObserver.observe(document, observerConfig);
    }

    document.querySelectorAll(".list-container").forEach((el) => {
        updateUI(el);
    });
})();
