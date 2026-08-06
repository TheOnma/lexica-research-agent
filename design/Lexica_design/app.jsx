// app.jsx — chat application shell

const SAMPLE_DOCS = [
  { id: 'd1', name: 'Attention is All You Need.pdf', type: 'PDF', pages: 15, chunks: 312, active: true },
  { id: 'd2', name: 'Climate Risk Report 2024.pdf', type: 'PDF', pages: 82, chunks: 1840 },
  { id: 'd3', name: 'Lit Review — Draft 4.docx', type: 'DOCX', pages: 24, chunks: 521 },
  { id: 'd4', name: 'Survey methodology.txt', type: 'TXT', pages: 6, chunks: 84 },
  { id: 'd5', name: 'WHO Air Quality Guidelines.pdf', type: 'PDF', pages: 360, chunks: 7210 },
];

const HISTORY = [
  { id: 'h1', t: 'Transformer self-attention key innovations', d: 'Today · 2:14 PM', active: true },
  { id: 'h2', t: 'Climate report — Arctic sea ice trajectory', d: 'Today · 11:03 AM' },
  { id: 'h3', t: 'PM2.5 thresholds vs. ozone', d: 'Yesterday' },
  { id: 'h4', t: 'Methodology section critique', d: '2 days ago' },
  { id: 'h5', t: 'Compare positional encoding schemes', d: 'Mar 28' },
];

const SUGGESTED = [
  "Summarise section 3.2 in two sentences",
  "Compare encoder and decoder stacks",
  "What's the dimensionality of the attention heads?",
  "Find every claim that cites Bahdanau et al.",
];

function App({ brandName, onClose }) {
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  const [activeCite, setActiveCite] = React.useState(1);
  const [activeDoc, setActiveDoc] = React.useState('d1');
  const [draft, setDraft] = React.useState('');

  const initials = (s) => s.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();

  return (
    <div className="app-screen open" data-screen-label="App">
      {/* TOP BAR */}
      <div className="app-top">
        <button className="icon-btn" onClick={onClose} title="Back to landing">
          <Icon.ArrowRight className="icon" style={{transform:'rotate(180deg)'}}/>
        </button>
        <div className="brand">
          <span className="brand-mark">{brandName.slice(0,1)}</span>
          <span>{brandName}</span>
        </div>
        <div style={{flex:1, display:'flex', justifyContent:'center'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius: 8, background:'var(--surface-2)', border:'1px solid var(--line-2)', fontSize:13, color:'var(--ink-2)', fontWeight:500}}>
            <Icon.Stack className="icon-sm"/>
            Research workspace
            <span style={{color:'var(--muted)', fontWeight:400}}>· 5 documents · 9,967 chunks</span>
          </div>
        </div>
        <button className={`icon-btn ${leftOpen?'active':''}`} onClick={()=>setLeftOpen(!leftOpen)} title="Toggle documents (⌘\\)"><Icon.Sidebar/></button>
        <button className={`icon-btn ${rightOpen?'active':''}`} onClick={()=>setRightOpen(!rightOpen)} title="Toggle preview"><Icon.PanelRight/></button>
        <button className="icon-btn"><Icon.Settings/></button>
        <div style={{width:1, height:20, background:'var(--line)', margin:'0 4px'}}/>
        <div className="avatar" style={{width:30, height:30, fontSize:12}}>JR</div>
      </div>

      {/* BODY */}
      <div className="app-body" data-left={leftOpen?'open':'closed'} data-right={rightOpen?'open':'closed'}>
        {/* LEFT — DOCS + HISTORY */}
        <aside className="panel">
          <div className="panel-body">
            <div className="upload-zone">
              <div className="icon"><Icon.Upload/></div>
              <div><strong>Drop a file</strong> or click to browse</div>
              <div style={{fontSize: 11.5, marginTop: 4, color:'var(--muted-2)'}}>PDF · DOCX · TXT · up to 50 MB</div>
            </div>

            <div className="doc-list">
              <div className="doc-list-label" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span>Documents · {SAMPLE_DOCS.length}</span>
                <button className="icon-btn" style={{width:22, height:22}}><Icon.Filter className="icon-sm"/></button>
              </div>
              {SAMPLE_DOCS.map(d => (
                <div key={d.id} className={`doc ${activeDoc===d.id?'active':''}`} onClick={()=>setActiveDoc(d.id)}>
                  <span className="ftype" style={d.type==='DOCX'?{background:'oklch(0.94 0.02 240)'}:d.type==='TXT'?{background:'oklch(0.94 0.04 60)'}:undefined}>{d.type}</span>
                  <div className="meta">
                    <div className="n">{d.name}</div>
                    <div className="s">{d.pages} pages · {d.chunks.toLocaleString()} chunks</div>
                  </div>
                  <button className="x" onClick={(e)=>{e.stopPropagation();}}><Icon.X className="icon-sm"/></button>
                </div>
              ))}
            </div>

            <div className="history">
              <div className="doc-list-label">
                <Icon.History className="icon-sm" style={{display:'inline', marginRight:6, verticalAlign:'-2px'}}/>
                Recent conversations
              </div>
              {HISTORY.map(h => (
                <div key={h.id} className={`history-item ${h.active?'active':''}`}>
                  <div className="t">{h.t}</div>
                  <div className="d">{h.d}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER — CHAT */}
        <main className="chat-col">
          <div className="chat-scroll">
            <div className="chat-inner">

              <div className="chat-doc-context">
                <span className="ftype" style={{width:22, height:26, borderRadius:3, background:'var(--accent-soft)', color:'var(--accent-ink)', display:'grid', placeItems:'center', font:'600 8px/1 JetBrains Mono'}}>PDF</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, fontSize:13}}>Attention is All You Need.pdf</div>
                  <div style={{fontSize:12, color:'var(--muted)'}}>Active context · 312 chunks indexed</div>
                </div>
                <button className="btn btn-ghost btn-sm"><Icon.Plus className="icon-sm"/>Add document</button>
              </div>

              {/* USER MSG */}
              <div className="msg user">
                <div className="who">JR</div>
                <div className="body">
                  <div className="label">You · 2:14 PM</div>
                  <div className="text">What's the key innovation behind the transformer architecture, and why did the authors move away from recurrence?</div>
                </div>
              </div>

              {/* BOT MSG */}
              <div className="msg bot">
                <div className="who">{brandName.slice(0,1)}</div>
                <div className="body">
                  <div className="label">{brandName} · GPT-4o · 0.84s</div>
                  <div className="text">
                    <p>
                      The transformer's central innovation is replacing recurrence and convolution with <strong>self-attention</strong> as
                      the sole mechanism for drawing dependencies between tokens
                      <span className={`cite ${activeCite===1?'active':''}`} onClick={()=>setActiveCite(1)}>1</span>.
                      Every position in the sequence can attend to every other position in a single step, giving the model
                      a constant path length between any two tokens
                      <span className={`cite ${activeCite===2?'active':''}`} onClick={()=>setActiveCite(2)}>2</span>.
                    </p>
                    <p>
                      The authors moved away from recurrence for two reasons. First, recurrent models compute sequentially,
                      which prevents parallelization within training examples and becomes prohibitive at long sequence lengths
                      <span className={`cite ${activeCite===3?'active':''}`} onClick={()=>setActiveCite(3)}>3</span>.
                      Second, the path length between distant tokens grows linearly with their distance in RNNs, making it
                      hard for them to learn long-range dependencies — self-attention reduces this to <em>O(1)</em>
                      <span className={`cite ${activeCite===2?'active':''}`} onClick={()=>setActiveCite(2)}>2</span>.
                    </p>
                    <p>
                      In return, the transformer trains <strong>significantly faster</strong> and reaches higher BLEU scores on
                      WMT 2014 English-to-German and English-to-French translation than any previously reported model, including
                      ensembles, at a fraction of the training cost
                      <span className={`cite ${activeCite===4?'active':''}`} onClick={()=>setActiveCite(4)}>4</span>.
                    </p>
                  </div>

                  <div className="sources">
                    <div className="sources-label">4 Sources</div>
                    {[
                      {n:1, doc:'Attention is All You Need.pdf', page:'p. 2 · §3', q:'The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.'},
                      {n:2, doc:'Attention is All You Need.pdf', page:'p. 6 · Table 1', q:'Self-attention layers connect all positions with a constant number of sequentially executed operations.'},
                      {n:3, doc:'Attention is All You Need.pdf', page:'p. 1 · §1', q:'This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths.'},
                      {n:4, doc:'Attention is All You Need.pdf', page:'p. 8 · §6.1', q:'Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU.'},
                    ].map(s=>(
                      <div key={s.n} className={`source ${activeCite===s.n?'active':''}`} onClick={()=>setActiveCite(s.n)}>
                        <div className="num">{s.n}</div>
                        <div className="src-body">
                          <div className="src-meta"><strong>{s.doc}</strong> · {s.page}</div>
                          <div className="src-quote">{s.q}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="actions">
                    <button className="act"><Icon.Copy className="icon-sm"/>Copy</button>
                    <button className="act"><Icon.Refresh className="icon-sm"/>Regenerate</button>
                    <button className="act"><Icon.ThumbsUp className="icon-sm"/></button>
                    <button className="act"><Icon.ThumbsDown className="icon-sm"/></button>
                  </div>

                  <div className="suggested">
                    {SUGGESTED.map((s,i)=>(
                      <button key={i} className="sug" onClick={()=>setDraft(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COMPOSER */}
          <div className="composer-wrap">
            <div className="composer">
              <textarea
                rows="2"
                placeholder={`Ask anything about your documents — try "compare sections 2 and 3"`}
                value={draft}
                onChange={(e)=>setDraft(e.target.value)}
              ></textarea>
              <div className="composer-row">
                <div className="toolbar">
                  <button className="act" title="Attach"><Icon.Plus className="icon-sm"/></button>
                  <button className="act"><Icon.Stack className="icon-sm"/>All docs</button>
                  <button className="act"><Icon.Sparkle className="icon-sm"/>HyDE</button>
                </div>
                <button className="send" disabled={!draft.trim()}>
                  Ask <Icon.ArrowUp className="icon-sm"/>
                </button>
              </div>
            </div>
            <div className="composer-hint">
              <span><span className="kbd">⏎</span> to send</span>
              <span><span className="kbd">⇧</span><span className="kbd">⏎</span> for newline</span>
              <span><span className="kbd">⌘</span><span className="kbd">K</span> commands</span>
              <span style={{marginLeft:'auto'}}>Answers grounded in your documents · GPT-4o</span>
            </div>
          </div>
        </main>

        {/* RIGHT — PDF PREVIEW */}
        <aside className="panel right">
          <div className="pdf-head">
            <div className="t">Attention is All You Need.pdf</div>
            <div className="m"><Icon.Doc className="icon-sm"/>Source [{activeCite}] · 15 pages</div>
          </div>
          <div className="pdf-toolbar">
            <button className="icon-btn" style={{width:24,height:24}}><Icon.Up className="icon-sm"/></button>
            <button className="icon-btn" style={{width:24,height:24}}><Icon.Down className="icon-sm"/></button>
            <span style={{flex:1, textAlign:'center'}}>p. {activeCite===1?2:activeCite===2?6:activeCite===3?1:8} / 15</span>
            <button className="icon-btn" style={{width:24,height:24}}><Icon.ZoomOut className="icon-sm"/></button>
            <button className="icon-btn" style={{width:24,height:24}}><Icon.ZoomIn className="icon-sm"/></button>
          </div>
          <div className="pdf-canvas">
            <PdfPage activeCite={activeCite}/>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PdfPage({ activeCite }) {
  // Render different page content based on the active citation
  if (activeCite === 1) {
    return (
      <div className="pdf-page">
        <div style={{fontSize:7, color:'#888', marginBottom:8}}>Vaswani et al., 2017 — page 2</div>
        <h2>3 The Transformer</h2>
        <p>Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations (x₁, …, xₙ) to a sequence of continuous representations z = (z₁, …, zₙ).</p>
        <p>Given z, the decoder then generates an output sequence (y₁, …, yₘ) of symbols one element at a time. At each step the model is auto-regressive, consuming the previously generated symbols as additional input when generating the next.</p>
        <p><span className="hl-strong">The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder</span>, shown in the left and right halves of Figure 1, respectively.</p>
        <h3>3.1 Encoder and Decoder Stacks</h3>
        <p><strong>Encoder:</strong> The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a simple, position-wise fully connected feed-forward network.</p>
        <p>We employ a residual connection around each of the two sub-layers, followed by layer normalization. That is, the output of each sub-layer is LayerNorm(x + Sublayer(x)).</p>
      </div>
    );
  }
  if (activeCite === 2) {
    return (
      <div className="pdf-page">
        <div style={{fontSize:7, color:'#888', marginBottom:8}}>Vaswani et al., 2017 — page 6</div>
        <h2>4 Why Self-Attention</h2>
        <p>In this section we compare various aspects of self-attention layers to the recurrent and convolutional layers commonly used for mapping one variable-length sequence to another.</p>
        <p>One is the total computational complexity per layer. Another is the amount of computation that can be parallelized, as measured by the minimum number of sequential operations required.</p>
        <p>The third is the path length between long-range dependencies in the network. <span className="hl-strong">Self-attention layers connect all positions with a constant number of sequentially executed operations</span>, whereas a recurrent layer requires O(n) sequential operations.</p>
        <h3>Table 1: Layer complexities</h3>
        <p style={{fontFamily:'JetBrains Mono', fontSize:7, lineHeight:1.5}}>Self-Attention &nbsp; O(n²·d) &nbsp; O(1) &nbsp; O(1)<br/>Recurrent &nbsp; O(n·d²) &nbsp; O(n) &nbsp; O(n)<br/>Convolutional &nbsp; O(k·n·d²) &nbsp; O(1) &nbsp; O(log_k(n))</p>
        <p>Learning long-range dependencies is a key challenge in many sequence transduction tasks. One key factor affecting the ability to learn such dependencies is the length of the paths forward and backward signals have to traverse in the network.</p>
      </div>
    );
  }
  if (activeCite === 3) {
    return (
      <div className="pdf-page">
        <div style={{fontSize:7, color:'#888', marginBottom:8}}>Vaswani et al., 2017 — page 1</div>
        <h2>1 Introduction</h2>
        <p>Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation.</p>
        <p>Recurrent models typically factor computation along the symbol positions of the input and output sequences. Aligning the positions to steps in computation time, they generate a sequence of hidden states hₜ, as a function of the previous hidden state hₜ₋₁ and the input for position t.</p>
        <p><span className="hl-strong">This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths</span>, as memory constraints limit batching across examples.</p>
        <p>In this work we propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output.</p>
      </div>
    );
  }
  return (
    <div className="pdf-page">
      <div style={{fontSize:7, color:'#888', marginBottom:8}}>Vaswani et al., 2017 — page 8</div>
      <h2>6 Results</h2>
      <h3>6.1 Machine Translation</h3>
      <p><span className="hl-strong">Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU.</span></p>
      <p>The configuration of this model is listed in the bottom line of Table 3. Training took 3.5 days on 8 P100 GPUs. Even our base model surpasses all previously published models and ensembles at a fraction of the training cost of any of the competitive models.</p>
      <p>On the WMT 2014 English-to-French translation task, our big model achieves a BLEU score of 41.0, outperforming all of the previously published single models, at less than 1/4 the training cost of the previous state-of-the-art model.</p>
      <h3>Table 2: BLEU on WMT 2014</h3>
      <p style={{fontFamily:'JetBrains Mono', fontSize:7, lineHeight:1.5}}>Transformer (big) &nbsp; 28.4 &nbsp; 41.8<br/>GNMT + RL &nbsp; 24.6 &nbsp; 39.9<br/>ConvS2S &nbsp; 25.16 &nbsp; 40.46</p>
    </div>
  );
}

window.App = App;
