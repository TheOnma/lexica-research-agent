// root.jsx — top-level: applies tweaks, switches between Landing and App

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "brand": "Lexica",
  "accent": "indigo",
  "fontPair": "Inter + Instrument Serif",
  "view": "landing"
}/*EDITMODE-END*/;

const ACCENTS = {
  indigo:   { l: "oklch(0.46 0.16 262)", soft: "oklch(0.94 0.04 262)", ink: "oklch(0.32 0.14 262)", dl: "oklch(0.72 0.14 262)", ds: "oklch(0.26 0.08 262)", di: "oklch(0.86 0.08 262)" },
  emerald:  { l: "oklch(0.5 0.13 158)",  soft: "oklch(0.94 0.04 158)", ink: "oklch(0.34 0.12 158)", dl: "oklch(0.74 0.13 158)", ds: "oklch(0.26 0.07 158)", di: "oklch(0.86 0.07 158)" },
  graphite: { l: "oklch(0.28 0.02 260)", soft: "oklch(0.94 0.005 260)",ink: "oklch(0.18 0.02 260)", dl: "oklch(0.85 0.01 260)", ds: "oklch(0.22 0.01 260)", di: "oklch(0.92 0.005 260)" },
  rose:     { l: "oklch(0.55 0.16 25)",  soft: "oklch(0.94 0.04 25)",  ink: "oklch(0.38 0.14 25)",  dl: "oklch(0.74 0.14 25)",  ds: "oklch(0.27 0.08 25)",  di: "oklch(0.86 0.08 25)" },
};

const FONT_PAIRS = {
  "Inter + Instrument Serif":  { body: "Inter",          display: "Instrument Serif" },
  "IBM Plex Sans + Fraunces":  { body: "IBM Plex Sans",  display: "Fraunces" },
  "Inter + Fraunces":          { body: "Inter",          display: "Fraunces" },
  "IBM Plex Sans + Inst. Serif": { body: "IBM Plex Sans",display: "Instrument Serif" },
};

const BRAND_OPTIONS = ["Lexica", "DocuAsk", "Citera"];

function Root(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const view = t.view || "landing";

  // theme
  React.useEffect(() => {
    document.body.dataset.theme = t.dark ? "dark" : "light";
  }, [t.dark]);

  // accent
  React.useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS.indigo;
    const root = document.documentElement;
    root.style.setProperty('--accent', t.dark ? a.dl : a.l);
    root.style.setProperty('--accent-soft', t.dark ? a.ds : a.soft);
    root.style.setProperty('--accent-ink', t.dark ? a.di : a.ink);
  }, [t.accent, t.dark]);

  // fonts
  React.useEffect(() => {
    const f = FONT_PAIRS[t.fontPair] || FONT_PAIRS["Inter + Instrument Serif"];
    document.body.style.setProperty('--font-body', `'${f.body}'`);
    document.body.style.setProperty('--font-display', `'${f.display}'`);
  }, [t.fontPair]);

  return (
    <>
      <Landing
        brandName={t.brand}
        onLaunch={() => setTweak('view', 'app')}
      />
      {view === 'app' && (
        <App
          brandName={t.brand}
          onClose={() => setTweak('view', 'landing')}
        />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme"/>
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v)=>setTweak('dark', v)}/>
        <TweakRadio
          label="Accent"
          value={t.accent}
          options={['indigo','emerald','graphite','rose']}
          onChange={(v)=>setTweak('accent', v)}
        />

        <TweakSection label="Typography"/>
        <TweakSelect
          label="Font pairing"
          value={t.fontPair}
          options={Object.keys(FONT_PAIRS)}
          onChange={(v)=>setTweak('fontPair', v)}
        />

        <TweakSection label="Brand"/>
        <TweakRadio
          label="Name"
          value={t.brand}
          options={BRAND_OPTIONS}
          onChange={(v)=>setTweak('brand', v)}
        />

        <TweakSection label="View"/>
        <TweakRadio
          label="Surface"
          value={t.view}
          options={['landing','app']}
          onChange={(v)=>setTweak('view', v)}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root/>);
