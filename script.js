
/* ---------------------------------------------------------------------------
   1. ADATOK – a zenei szakaszok kezdő bekezdései
      (a HTML-ben a "music-trigger" osztályú bekezdések felelnek meg nekik)
   --------------------------------------------------------------------------- */
const tracks = [
    { start:  1, title: "Nas - Get Down (Instrumental)", subtitle: "Tűntetés", number: 1 },
    { start: 9, title: "Tűntetés",   subtitle: "Atmoszféra hangok",  number: 2 },
    { start: 10, title: "Atlanti-óceánpart",         subtitle: "Atmoszféra hangok", number: 3 },
    { start: 12, title: "Kool & The Gang - Jungle Boogie (1973) Original Instrumental", subtitle: "Autózás", number: 4 },
    { start: 15, title: "Utca",          subtitle: "Atmoszféra",     number: 5 }
    
];

const byId = (id) => document.getElementById(id);


/* ---------------------------------------------------------------------------
   2. HANG – két lejátszó a zökkenőmentes (3 mp-es) áttűnéshez
   --------------------------------------------------------------------------- */
const players = [new Audio(), new Audio()];
players.forEach((audio) => {
    audio.loop = true;
    audio.preload = "none";
    audio.volume = 0;
});

const formats = ["mp3", "ogg", "m4a", "wav"];   // ebben a sorrendben próbálja
let activePlayer = 0;
let currentTrackIndex = -1;
let audioEnabled = false;
let muted = false;
let fadeToken = 0;
let loadToken = 0;

const playButton       = byId("toggle");
const introMusicButton = byId("introMusicButton");
const introMusicLabel  = byId("introMusicLabel");
const status           = byId("status");

function getVolume() {
    return muted ? 0 : Number(byId("volume").value) / 100;
}

// Hangerő fokozatos változtatása (áttűnés)
function fadeVolume(audio, from, to, duration, token) {
    return new Promise((resolve) => {
        const startTime = performance.now();
        audio.volume = from;

        function step(now) {
            if (token !== fadeToken) { resolve(); return; }

            const progress = Math.min(1, (now - startTime) / duration);
            audio.volume = Math.max(0, Math.min(1, from + (to - from) * progress));

            if (progress < 1) requestAnimationFrame(step);
            else resolve();
        }
        requestAnimationFrame(step);
    });
}

// Hangfájl betöltése; ha egy formátum nincs meg, a következőt próbálja
async function loadAudioWithFallback(audio, track, token) {
    const thisLoadToken = ++loadToken;

    for (const extension of formats) {
        if (token !== fadeToken || thisLoadToken !== loadToken) return false;

        audio.src = `audio/${track.number}.${extension}`;
        audio.load();

        try {
            await audio.play();

            if (token !== fadeToken || thisLoadToken !== loadToken) {
                audio.pause();
                return false;
            }
            return true;
        } catch (error) {
            if (error && error.name === "NotAllowedError") {
                status.textContent =
                    "A böngésző letiltotta az automatikus hangot. Kattints a Hang indítása gombra.";
                return false;
            }
            // Hibás formátum vagy hiányzó fájl: jöhet a következő kiterjesztés.
        }
    }

    status.textContent =
        `Nem található lejátszható audio/${track.number} fájl. Tegyél MP3-at az audio/ mappába.`;
    return false;
}

// Zeneszakasz váltása áttűnéssel
async function switchTrack(index) {
    if (index < 0 || index >= tracks.length || index === currentTrackIndex) return;

    currentTrackIndex = index;
    const track = tracks[index];

    byId("trackTitle").textContent = track.title;
    byId("subtitle").textContent = track.subtitle;

    if (!audioEnabled) {
        status.textContent = "A zeneszakasz kiválasztva. Kattints a Hang indítása gombra.";
        return;
    }

    const token = ++fadeToken;
    const oldPlayer = players[activePlayer];
    const nextPlayerIndex = 1 - activePlayer;
    const nextPlayer = players[nextPlayerIndex];

    nextPlayer.pause();
    nextPlayer.currentTime = 0;
    nextPlayer.volume = 0;

    const loaded = await loadAudioWithFallback(nextPlayer, track, token);
    if (!loaded || token !== fadeToken) return;

    activePlayer = nextPlayerIndex;
    status.textContent = "Lejátszás folyamatban · 3 másodperces áttűnés";

    await Promise.all([
        fadeVolume(oldPlayer, oldPlayer.volume, 0, 3000, token),
        fadeVolume(nextPlayer, 0, getVolume(), 3000, token)
    ]);

    if (token === fadeToken) {
        oldPlayer.pause();
        oldPlayer.currentTime = 0;
    }
}

// A két indítógomb (alsó sáv + bevezető alatti) felirata mindig az aktuális állapotot mutatja
function syncPlayButtons() {
    playButton.textContent = audioEnabled ? "Ⅱ Hang szüneteltetése" : "▶ Hang indítása";

    introMusicLabel.textContent = audioEnabled ? "Zene szüneteltetése" : "Zene indítása";
    const label = audioEnabled ? "Háttérzene szüneteltetése" : "Háttérzene indítása";
    introMusicButton.setAttribute("aria-label", label);
    introMusicButton.title = label;
    introMusicButton.classList.toggle("is-playing", audioEnabled);
}


/* ---------------------------------------------------------------------------
   3. VEZÉRLŐK – indítás/szünet, némítás, hangerő, betűméret
   --------------------------------------------------------------------------- */
playButton.addEventListener("click", async () => {
    if (audioEnabled) {
        audioEnabled = false;
        fadeToken += 1;

        players.forEach((audio) => { audio.pause(); audio.volume = 0; });

        syncPlayButtons();
        status.textContent = "A háttérzene szünetel.";
        return;
    }

    audioEnabled = true;
    syncPlayButtons();

    const indexToPlay = Math.max(0, currentTrackIndex);
    currentTrackIndex = -1;
    await switchTrack(indexToPlay);
});

// A bevezető alatti gomb az alsó gombot működteti
introMusicButton.addEventListener("click", () => playButton.click());

byId("mute").addEventListener("click", (event) => {
    muted = !muted;
    event.currentTarget.textContent = muted ? "Hang vissza" : "Némítás";
    event.currentTarget.setAttribute("aria-pressed", String(muted));
    players[activePlayer].volume = getVolume();
});

byId("volume").addEventListener("input", () => {
    if (!muted) players[activePlayer].volume = getVolume();
});

byId("fontSize").addEventListener("change", (event) => {
    document.documentElement.style.setProperty("--reading-size", event.target.value);
});


/* ---------------------------------------------------------------------------
   4. ZENEVÁLTÁS GÖRGETÉSRE
      Amikor egy "music-trigger" bekezdés a képernyő közepére ér, a zene vált.
   --------------------------------------------------------------------------- */
const observer = new IntersectionObserver((entries) => {
    const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (!visibleEntries.length) return;

    const paragraphNumber = Number(visibleEntries[0].target.dataset.paragraph);
    const trackIndex = tracks.findIndex((track) => track.start === paragraphNumber);

    if (trackIndex >= 0) switchTrack(trackIndex);
}, {
    rootMargin: "-35% 0px -35% 0px",
    threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
});

document.querySelectorAll(".music-trigger").forEach((paragraph) => observer.observe(paragraph));

byId("trackTitle").textContent = tracks[0].title;
byId("subtitle").textContent = "A 10. bekezdésig bevezető hangulat";


/* ---------------------------------------------------------------------------
   5. HÁTTÉR-PARALLAX (nagyobb kijelzőn)
   --------------------------------------------------------------------------- */
const parallax = byId("parallax");
let parallaxQueued = false;

window.addEventListener("scroll", () => {
    if (parallaxQueued) return;

    parallaxQueued = true;
    requestAnimationFrame(() => {
        parallax.style.setProperty("--py", `${Math.min(window.scrollY * -0.035, 0)}px`);
        const tilt = Math.max(-1.5, Math.min(1.5, window.scrollY * 0.0004));
        parallax.style.setProperty("--tilt", `${tilt}deg`);
        parallaxQueued = false;
    });
}, { passive: true });


/* ---------------------------------------------------------------------------
   6. MENÜ – nyitás/zárás (két vonal ↔ X), Esc-re és linkre is bezár
   --------------------------------------------------------------------------- */
const menuToggle = byId("menuToggle");
const siteMenu = byId("siteMenu");

function setMenuOpen(open) {
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Menü bezárása" : "Menü megnyitása");
    siteMenu.classList.toggle("is-open", open);
    siteMenu.setAttribute("aria-hidden", String(!open));
}

menuToggle.addEventListener("click", () => {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

document.querySelectorAll("[data-menu-close]").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
});


/* ---------------------------------------------------------------------------
   7. FEJLÉC ÉS MENÜGOMB – lefelé görgetve együtt tűnnek el,
      felfelé görgetve együtt térnek vissza
   --------------------------------------------------------------------------- */
const siteHeader = byId("siteHeader");
let previousScrollY = window.scrollY;
let scrollTicking = false;

window.addEventListener("scroll", () => {
    if (scrollTicking) return;

    scrollTicking = true;
    requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - previousScrollY;

        if (currentY < 60 || delta < -5) {
            siteHeader.classList.remove("is-hidden");
            menuToggle.classList.remove("is-hidden");   // a menügomb a fejléccel együtt jelenik meg
        } else if (delta > 5) {
            siteHeader.classList.add("is-hidden");
            menuToggle.classList.add("is-hidden");      // és a fejléccel együtt tűnik el
            setMenuOpen(false);
        }

        previousScrollY = currentY;
        scrollTicking = false;
    });
}, { passive: true });


/* ---------------------------------------------------------------------------
   8. NYOMDAI SZEDÉSHIBÁK – betűköz, apró elfordulás, fel/le csúszás
      A betűk élét, színét, vastagságát nem érinti: csak a pozíciójukat.
      Rögzített magértékkel (seed) fut, ezért minden betöltésnél azonos az eredmény.
      Állítható értékek (a kód elején):
   --------------------------------------------------------------------------- */
const LETTERPRESS = {
    oddWordChance: 0.12,  // a szavak ennyi részében van egy szedéshibás betű (0.12 = 12%)
    rotateDeg:   1.1,     // legnagyobb elfordulás fokban (±)
    shiftEm:     0.005,   // legnagyobb fel/le csúszás betűmagasságban (±)
    sideEm:      0.02,    // legnagyobb oldalirányú eltérés az ilyen betű körül (±)
    spacingEm:   0.035,   // legnagyobb betűköz-változás (±), 3–5 betűs csoportonként
    chunk:       [5, 8]   // egy betűköz-csoport hossza (legkisebb, legnagyobb)
};

// Kicsi, rögzített magértékű véletlengenerátor (mulberry32)
function seededRandom(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const between = (rand, max) => (rand() * 2 - 1) * max;   // −max … +max

// Egy szót csoportokra bont; a csoportok külön betűközt kapnak,
// néhány betű pedig elfordul / elcsúszik

function setWord(word, rand, skipOdd) {
    const chars = [...word];

    // Melyik betű lesz szedéshibás (legfeljebb egy szavanként)
    let oddIndex = -1;
    if (!skipOdd && rand() < LETTERPRESS.oddWordChance) {
        const candidates = [];
        chars.forEach((character, index) => { if (/\p{L}/u.test(character)) candidates.push(index); });
        if (candidates.length) oddIndex = candidates[Math.floor(rand() * candidates.length)];
    }

    const fragment = document.createDocumentFragment();
    let holder = null;
    if (oddIndex >= 0) {
        holder = document.createElement("span");
        holder.className = "w-set";
        fragment.appendChild(holder);
    }
    const container = holder || fragment;

    let buffer = "";
    let bufferLength = 0;

    const newTarget = () =>
        LETTERPRESS.chunk[0] + Math.floor(rand() * (LETTERPRESS.chunk[1] - LETTERPRESS.chunk[0] + 1));
    let target = newTarget();

    const flush = () => {
        if (!buffer) return;
        const group = document.createElement("span");
        group.style.letterSpacing = between(rand, LETTERPRESS.spacingEm).toFixed(3) + "em";
        group.textContent = buffer;
        container.appendChild(group);
        buffer = "";
        bufferLength = 0;
        target = newTarget();
    };

    chars.forEach((character, index) => {
        if (index === oddIndex) {
            flush();
            const oddLetter = document.createElement("span");
            oddLetter.className = "t";
            oddLetter.textContent = character;
            oddLetter.style.transform =
                `translateY(${between(rand, LETTERPRESS.shiftEm).toFixed(3)}em) ` +
                `rotate(${between(rand, LETTERPRESS.rotateDeg).toFixed(2)}deg)`;
            oddLetter.style.margin = `0 ${Math.abs(between(rand, LETTERPRESS.sideEm)).toFixed(3)}em`;
            container.appendChild(oddLetter);
            return;
        }

        buffer += character;
        bufferLength += 1;
        if (bufferLength >= target) flush();
    });
    flush();

    return fragment;
}

// Végigmegy egy bekezdés összes szövegcsomópontján (a <em>, <strong> megmarad)
function applyLetterpress(paragraphElement, seed) {
    const rand = seededRandom(seed);
    const protectFirst = paragraphElement.parentElement.classList.contains("paragraph--chapter");
    const walker = document.createTreeWalker(paragraphElement, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    let firstWord = true;

    textNodes.forEach((textNode) => {
        const fragment = document.createDocumentFragment();

        textNode.nodeValue.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                fragment.appendChild(document.createTextNode(part));
                return;
            }
            fragment.appendChild(setWord(part, rand, protectFirst && firstWord));
            firstWord = false;
        });

        textNode.parentNode.replaceChild(fragment, textNode);
    });
}

document.querySelectorAll(".paragraph").forEach((paragraph) => {
    const p = paragraph.querySelector("p");
    if (p) applyLetterpress(p, Number(paragraph.dataset.paragraph) * 7919 + 13);
});


/* ---------------------------------------------------------------------------
   9. LEJÁTSZÓ ÖSSZECSUKÁSA – összecsukva csak a visszanyitó gomb látszik
   --------------------------------------------------------------------------- */
const playerToggle = byId("playerToggle");

playerToggle.addEventListener("click", () => {
    const player = byId("player");
    const collapsed = player.classList.toggle("is-hidden");

    playerToggle.setAttribute("aria-expanded", String(!collapsed));
    playerToggle.setAttribute("aria-label", collapsed ? "Lejátszó kinyitása" : "Lejátszó összecsukása");
    playerToggle.textContent = collapsed ? "⌃" : "⌄";
});
