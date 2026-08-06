// landing.jsx — marketing surface

function Landing({ brandName, accent, onLaunch }) {
  return (
    <div data-screen-label="Landing">
      {/* NAV */}
      <nav className="nav">
        <div className="container nav-row">
          <a className="brand" href="#">
            <span className="brand-mark">{brandName.slice(0,1)}</span>
            <span>{brandName}</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#testimonials">Customers</a>
            <a href="#pricing">Pricing</a>
            <a href="#docs">Docs</a>
          </div>
          <div className="nav-spacer"></div>
          <a className="btn btn-ghost btn-sm" href="#" onClick={(e)=>{e.preventDefault(); onLaunch();}}>Sign in</a>
          <button className="btn btn-primary btn-sm" onClick={onLaunch}>
            Open app <Icon.ArrowRight className="icon-sm"/>
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">
                <span className="dot"><Icon.Sparkle className="icon-sm"/></span>
                New · Hybrid retrieval with HyDE + BM25
              </span>
              <h1 className="h1">
                Ask your documents <em>anything.</em><br/>
                Get answers you can <em>cite.</em>
              </h1>
              <p className="lead">
                {brandName} reads your PDFs, papers and reports, then answers questions
                in your own words — every claim grounded in the exact page it came from.
                Built for researchers and students who refuse to guess.
              </p>
              <div className="hero-cta">
                <button className="btn btn-primary" onClick={onLaunch}>
                  Try it free <Icon.ArrowRight className="icon-sm"/>
                </button>
                <a className="btn btn-ghost" href="#how">See how it works</a>
              </div>
              <div className="hero-meta">
                <span><span className="check"><Icon.Check className="icon-sm"/></span> No credit card</span>
                <span><span className="check"><Icon.Check className="icon-sm"/></span> 50 pages free</span>
                <span><span className="check"><Icon.Check className="icon-sm"/></span> Your files stay private</span>
              </div>
            </div>

            {/* preview card */}
            <div className="hero-preview" aria-hidden="true">
              <div className="hero-preview-bar">
                <div className="dots"><span/><span/><span/></div>
                <div className="url">
                  <Icon.Lock className="icon-sm"/>
                  <span>{brandName.toLowerCase()}.app /workspace/research</span>
                </div>
              </div>
              <div className="hero-preview-body">
                {/* mini docs panel */}
                <div className="panel" style={{padding: '12px'}}>
                  <div className="doc-list-label">Documents · 3</div>
                  <div className="doc active">
                    <span className="ftype">PDF</span>
                    <div className="meta"><div className="n">Attention is All You Need.pdf</div><div className="s">15 pages · 312 chunks</div></div>
                  </div>
                  <div className="doc">
                    <span className="ftype">PDF</span>
                    <div className="meta"><div className="n">Climate Report 2024.pdf</div><div className="s">82 pages</div></div>
                  </div>
                  <div className="doc">
                    <span className="ftype" style={{background:'oklch(0.94 0.02 240)'}}>DOCX</span>
                    <div className="meta"><div className="n">Lit Review draft.docx</div><div className="s">24 pages</div></div>
                  </div>
                </div>
                {/* mini chat */}
                <div style={{padding: '20px 24px', display:'flex', flexDirection:'column', gap: 18, background: 'var(--bg)', borderLeft: '1px solid var(--line-2)', borderRight: '1px solid var(--line-2)'}}>
                  <div className="msg user">
                    <div className="who">JR</div>
                    <div className="body"><div className="text" style={{fontSize: 14}}>What's the key innovation behind the transformer architecture?</div></div>
                  </div>
                  <div className="msg bot">
                    <div className="who">L</div>
                    <div className="body">
                      <div className="text" style={{fontSize: 13.5, lineHeight: 1.6}}>
                        The transformer replaces recurrence and convolution with <strong>self-attention</strong> alone
                        <span className="cite">1</span>, allowing for far greater parallelization and shorter paths
                        between any two positions in the sequence <span className="cite">2</span>.
                      </div>
                      <div className="sources" style={{marginTop: 12}}>
                        <div className="source">
                          <div className="num">1</div>
                          <div className="src-body">
                            <div className="src-meta"><strong>Attention is All You Need.pdf</strong> · p. 2</div>
                          </div>
                        </div>
                        <div className="source">
                          <div className="num">2</div>
                          <div className="src-body">
                            <div className="src-meta"><strong>Attention is All You Need.pdf</strong> · p. 6</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* mini pdf */}
                <div style={{background: 'var(--surface-2)', borderLeft: '0', display:'flex', flexDirection:'column'}}>
                  <div className="pdf-toolbar">p. 2 / 15 · 100%</div>
                  <div className="pdf-canvas" style={{padding: 12}}>
                    <div className="pdf-page" style={{maxWidth: 220, fontSize: 7, padding: '14px 12px'}}>
                      <h2 style={{fontSize: 11}}>3 The Transformer</h2>
                      <p>Most competitive neural sequence transduction models have an encoder-decoder structure.</p>
                      <p>Here, the encoder maps an input sequence (x₁, ..., xₙ) to a sequence of continuous representations.</p>
                      <p><span className="hl-strong">The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers</span> for both the encoder and decoder.</p>
                      <h3 style={{fontSize: 9}}>3.1 Encoder and Decoder Stacks</h3>
                      <p>Encoder: composed of a stack of N=6 identical layers.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOGOS */}
      <section className="logos">
        <div className="container">
          <div className="logos-label">Trusted by researchers and students at</div>
          <div className="logos-row">
            <div className="logo" style={{fontFamily:'Fraunces'}}>Stanford</div>
            <div className="logo" style={{fontFamily:'Inter', fontWeight:800, letterSpacing:'-0.06em'}}>MIT·Media</div>
            <div className="logo" style={{fontFamily:'Instrument Serif', fontStyle:'italic', fontSize: 22}}>Cambridge</div>
            <div className="logo" style={{fontFamily:'JetBrains Mono', fontSize: 14}}>{`{ETH}`}</div>
            <div className="logo" style={{fontFamily:'Fraunces', fontWeight:600}}>Northwind Press</div>
            <div className="logo" style={{fontFamily:'Inter', fontWeight:700}}>NeurIPS·Hub</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="container">
          <span className="section-eyebrow">Features</span>
          <h2 className="section-title">Built for work that <em>cannot</em> afford to be wrong.</h2>
          <p className="section-lead">Every answer ships with the page it came from, the chunk it quoted and a path back to the source.</p>

          <div className="feat-grid">
            {[
              {i: <Icon.Cite/>, t: "Inline citations", d: "Click any number in an answer to jump to the exact paragraph in the original PDF — highlighted, in context, on the right page."},
              {i: <Icon.Stack/>, t: "Hybrid retrieval", d: "Dense vector search + BM25 keyword matching, fused with Reciprocal Rank Fusion. Catches both semantic intent and exact terminology."},
              {i: <Icon.Sparkle/>, t: "HyDE pre-search", d: "We generate a hypothetical answer first, then search with it. Retrieves relevant passages even when your question and the source use different wording."},
              {i: <Icon.Lock/>, t: "Private by default", d: "Your documents are stored on isolated infrastructure. No training on your data, ever. Delete and they're gone in minutes."},
              {i: <Icon.Bolt/>, t: "Fast where it counts", d: "Sub-second retrieval over thousands of pages. Streaming answers with citations rendered as they arrive."},
              {i: <Icon.Globe/>, t: "PDF, DOCX, TXT", d: "Drop in research papers, government reports, your committee's draft. We chunk it cleanly with structure and headings preserved."},
            ].map((f,i)=>(
              <div key={i} className="feat">
                <div className="feat-icon">{f.i}</div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="section" id="how">
        <div className="container">
          <span className="section-eyebrow">How it works</span>
          <h2 className="section-title">From upload to <em>cited</em> answer in four steps.</h2>

          <div className="how-grid">
            {[
              {n:"01", t:"Upload", d:"Drag in PDFs, Word docs or plain text. We parse, chunk and embed everything in seconds."},
              {n:"02", t:"Ask", d:"Type a question the way you'd ask a colleague. Be vague, be precise — both work."},
              {n:"03", t:"Retrieve", d:"Hybrid search pulls the most relevant chunks across all your documents, ranked together."},
              {n:"04", t:"Verify", d:"Read the answer, click any citation, land on the highlighted line of the original page."},
            ].map((s)=>(
              <div key={s.n} className="how-step">
                <div className="num">{s.n}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section" id="testimonials">
        <div className="container">
          <span className="section-eyebrow">Customers</span>
          <h2 className="section-title">What people who actually <em>read</em> things are saying.</h2>

          <div className="quotes">
            {[
              {s:5, q:"I used to keep three monitors open just to cross-reference papers for my thesis. Now I drop them all in here and ask. The citations are what sold me — I can defend every claim.", n:"Júlia Rocha", r:"PhD candidate, Computational Biology"},
              {s:5, q:"Finally a tool that doesn't make things up. When it doesn't have an answer, it tells me — instead of confidently inventing one. That's the only reason I trust it.", n:"Marcus Lindgren", r:"Senior Researcher, Policy Institute"},
              {s:5, q:"I run a 200-person reading group. We share workspaces and the cited answers cut my prep time in half. Worth every cent of the team plan.", n:"Aisha Okafor", r:"History MA, Edinburgh"},
            ].map((t,i)=>(
              <div key={i} className="quote">
                <div className="stars">★★★★★</div>
                <p>"{t.q}"</p>
                <div className="who">
                  <div className="avatar">{t.n.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
                  <div className="who-meta">
                    <div className="n">{t.n}</div>
                    <div className="r">{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section" id="pricing">
        <div className="container">
          <span className="section-eyebrow">Pricing</span>
          <h2 className="section-title">Start free. Upgrade when you've got a deadline.</h2>

          <div className="price-grid">
            <div className="price">
              <div className="name">Free</div>
              <div className="amount">$0<span> / forever</span></div>
              <div className="desc">For trying it out and casual use.</div>
              <ul>
                <li>50 pages of documents</li>
                <li>30 questions / month</li>
                <li>Inline citations</li>
                <li>PDF, DOCX, TXT</li>
              </ul>
              <button className="btn btn-ghost" onClick={onLaunch} style={{marginTop:'auto', justifyContent:'center'}}>Get started</button>
            </div>
            <div className="price featured">
              <span className="pill badge">Most popular</span>
              <div className="name">Pro</div>
              <div className="amount">$12<span> / month</span></div>
              <div className="desc">For students and researchers who live in their library.</div>
              <ul>
                <li>5,000 pages of documents</li>
                <li>Unlimited questions</li>
                <li>GPT-4o answers</li>
                <li>Saved conversations</li>
                <li>Priority retrieval queue</li>
              </ul>
              <button className="btn btn-primary" onClick={onLaunch} style={{justifyContent:'center'}}>Start 14-day trial</button>
            </div>
            <div className="price">
              <div className="name">Team</div>
              <div className="amount">$29<span> / user / month</span></div>
              <div className="desc">For labs, reading groups and editorial teams.</div>
              <ul>
                <li>Shared workspaces</li>
                <li>Unlimited pages & questions</li>
                <li>SSO & audit log</li>
                <li>API access</li>
                <li>SOC 2, on request</li>
              </ul>
              <button className="btn btn-ghost" onClick={onLaunch} style={{marginTop:'auto', justifyContent:'center'}}>Talk to sales</button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="container">
          <div className="cta-block">
            <h2 className="h-cta">Stop hunting for the right page.<br/><em>Just ask.</em></h2>
            <p className="lead">Upload your first document in under a minute. No credit card, no setup.</p>
            <button className="btn btn-primary" onClick={onLaunch}>
              Open {brandName} <Icon.ArrowRight className="icon-sm"/>
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%'}}>
          <div>© {new Date().getFullYear()} {brandName}. Built for people who read carefully.</div>
          <div style={{display:'flex', gap: 20}}>
            <a href="#" style={{color:'inherit'}}>Privacy</a>
            <a href="#" style={{color:'inherit'}}>Terms</a>
            <a href="#" style={{color:'inherit'}}>Status</a>
            <a href="#" style={{color:'inherit'}}>Changelog</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

window.Landing = Landing;
