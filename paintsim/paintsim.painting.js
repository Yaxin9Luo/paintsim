/*! PaintSim paintings — a whole picture as data, on top of the code API.

    A painting is one JSON object: the page, the ground, the light, any recipes of its own, and a list of steps.
    Every step does one thing, and which thing is decided by the key it has:

      path / paths   a stroke (or several)   with the fields of surface.paint()
      shape          a filled area           with the fields of surface.fill()
      at / dots      a dot (or several)      with the fields of surface.dot()
      flow           time passes for wet washes          dry     everything dries (true, an amount 0–1, or "still")
      do             a group of steps; `with` gives them shared fields; a top-level step is a stage, named by `name`

    PaintSim.check(painting)                  → a list of problems (empty when it is sound)
    PaintSim.open(painting, {canvas, scale})  → a player: next(), run(n), runFor(ms), finish(); .surface .stages .at .total
    PaintSim.render(painting, {scale})        → the finished surface
    Lengths are page units, so `scale` (pixels per unit) is chosen when rendering, not in the painting.               */
(function(P){
'use strict';
const FORMAT=1;
const TOP=['paintsim','engine','title','note','size','ground','light','seed','define','shapes','steps'];
const DEFINE={materials:'material',brushes:'brush',grounds:'ground',lights:'light',pigments:'pigment'};
const F={   // the fields a step may carry besides the key that says what it is
  stroke:['material','brush','width','pressure','press','color','color2','opacity','grad','load','wobble','tone2','spline','seg','clip','opts'],
  fill:['material','color','color2','opacity','soft','uneven','scale','angle','cushion','clip'],
  dot:['material','color','opacity','soft','dome','r'],flow:[],dry:[],group:['with']};
const KEY={stroke:['path','paths'],fill:['shape'],dot:['at','dots'],flow:['flow'],dry:['dry'],group:['do']};
const COMMON=['name','note','hide','seed'],WITH=[...new Set([...F.stroke,...F.fill,...F.dot])];
const NUMBERS=['width','press','opacity','grad','load','wobble','tone2','seg','soft','uneven','scale','angle','dome','r'];
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),num=v=>typeof v==='number'&&isFinite(v),isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const isPt=p=>Array.isArray(p)&&p.length>=2&&num(p[0])&&num(p[1]);

// "did you mean": the nearest known word, if it is near enough
function near(word,list){let best=null,bd=3;const a=String(word).toLowerCase();
  for(const w of list){const b=w.toLowerCase();if(Math.abs(a.length-b.length)>2)continue;let prev=[];for(let j=0;j<=b.length;j++)prev[j]=j;
    for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}
    if(prev[b.length]<bd){bd=prev[b.length];best=w}}
  return best?' (did you mean "'+best+'"?)':''}
const unknownKey=(k,list)=>'unknown field "'+k+'"'+near(k,list);

/* ---------- shapes: a polygon, a list of them, a name from `shapes`, or {rect} {circle} {ellipse} {curve} ---------- */
function shapePolys(spec,shapes,depth){depth=depth|0;
  if(typeof spec==='string'){if(!shapes||!has(shapes,spec))throw new Error('unknown shape "'+spec+'"'+near(spec,Object.keys(shapes||{})));
    if(depth>8)throw new Error('shape "'+spec+'" refers to itself');return shapePolys(shapes[spec],shapes,depth+1)}
  if(Array.isArray(spec)){if(!spec.length)throw new Error('an empty shape');
    if(isPt(spec[0])){if(spec.length<3)throw new Error('a polygon needs at least 3 points');const bad=spec.findIndex(p=>!isPt(p));if(bad>=0)throw new Error('point '+(bad+1)+' of the polygon is not [x, y]');return[spec]}
    return[].concat(...spec.map(q=>shapePolys(q,shapes,depth+1)))}
  if(isObj(spec)){const ks=Object.keys(spec),v=spec[ks[0]],nums=n=>Array.isArray(v)&&v.length>=n&&v.every(num);
    if(ks.length!==1)throw new Error('a shape object has exactly one of: rect, circle, ellipse, curve, polygon');
    switch(ks[0]){
      case'rect':if(!nums(4))throw new Error('rect is [x0, y0, x1, y1]');return[P.util.rect(v[0],v[1],v[2],v[3])];
      case'circle':case'ellipse':{const el=ks[0]==='ellipse';if(!nums(el?4:3))throw new Error(el?'ellipse is [cx, cy, rx, ry] or [cx, cy, rx, ry, degrees]':'circle is [cx, cy, r]');
        const rx=v[2],ry=el?v[3]:v[2],rot=(el&&v[4]||0)*Math.PI/180,n=Math.max(24,Math.min(240,Math.ceil(2*Math.PI*Math.max(rx,ry)/1.2))),ca=Math.cos(rot),sa=Math.sin(rot),o=[];
        if(!(rx>0&&ry>0))throw new Error('a radius must be more than 0');
        for(let i=0;i<n;i++){const t=i/n*2*Math.PI,x=Math.cos(t)*rx,y=Math.sin(t)*ry;o.push([v[0]+x*ca-y*sa,v[1]+x*sa+y*ca])}return[o]}
      case'curve':if(!Array.isArray(v)||v.length<3||!v.every(isPt))throw new Error('curve is a list of at least 3 points; the outline runs smoothly through them and closes');return[P.util.spline(v,10,true)];
      case'polygon':return shapePolys(v,shapes,depth+1);
      default:throw new Error('unknown kind of shape "'+ks[0]+'"'+near(ks[0],['rect','circle','ellipse','curve','polygon']))}}
  throw new Error('a shape is a list of points, a name, or {rect} {circle} {ellipse} {curve}')}

function kindOf(st){let kind=null;for(const k of Object.keys(KEY))if(KEY[k].some(q=>has(st,q))){if(kind)return null;kind=k}return kind}

/* ---------- check: everything that can be wrong with a painting, said where it is ---------- */
function check(doc){const out=[],add=(at,m)=>out.push(at?at+': '+m:m);
  if(!isObj(doc))return['a painting is an object: {"paintsim": 1, "size": [width, height], "steps": [ … ]}'];
  for(const k of Object.keys(doc))if(!TOP.includes(k))add('',unknownKey(k,TOP));
  if(doc.paintsim!==FORMAT)add('paintsim',doc.paintsim===undefined?'missing: say "paintsim": '+FORMAT+' (the version of this format)':'this reader understands format '+FORMAT+', not '+JSON.stringify(doc.paintsim));
  if(!(Array.isArray(doc.size)&&doc.size.length===2&&doc.size.every(v=>num(v)&&v>=8&&v<=20000)))add('size','must be [width, height] in page units (each 8 to 20000)');
  if(doc.seed!==undefined&&!num(doc.seed))add('seed','must be a number');
  const defs=doc.define;
  if(defs!==undefined&&!isObj(defs)){add('define','must be an object with any of: '+Object.keys(DEFINE).join(', '));return out}
  for(const k of Object.keys(defs||{})){if(!DEFINE[k])add('define',unknownKey(k,Object.keys(DEFINE)));else if(!isObj(defs[k]))add('define.'+k,'must be an object of name: recipe')}
  const names=kind=>Object.keys(P[kind==='brush'?'brushes':kind+'s']).concat(Object.keys(isObj(defs)&&isObj(defs[kind==='brush'?'brushes':kind+'s'])?defs[kind==='brush'?'brushes':kind+'s']:{}));
  const recipe=(at,kind,v)=>{if(typeof v!=='string'&&!isObj(v)&&!(kind==='pigment'&&Array.isArray(v)))return add(at,'must be a name or a recipe');
    for(const m of P.lint(kind,v)){const u=/^unknown (material|brush|ground|light|pigment) "(.*)"$/.exec(m);add(at,u?m+near(u[2],names(u[1])):m)}};
  const colour=(at,v)=>{try{P.color(v)}catch(e){add(at,String(e.message).replace('PaintSim: ',''))}};
  const fields=(at,o)=>{for(const k of Object.keys(o)){const v=o[k],w=at+'.'+k;if(v===null||v===undefined)continue;
    if(k==='material'||k==='brush')recipe(w,k,v);
    else if(k==='color'||k==='color2')colour(w,v);
    else if(k==='pressure'){if(!(typeof v==='string'?has(P.profiles,v):Array.isArray(v)&&v.length>=2&&v.every(num)))add(w,typeof v==='string'?'unknown pressure profile "'+v+'"'+near(v,Object.keys(P.profiles)):'must be a profile name or a list of numbers')}
    else if(k==='clip'){try{shapePolys(v,doc.shapes)}catch(e){add(w,e.message)}}
    else if(NUMBERS.includes(k)){if(!num(v))add(w,'must be a number')}
    else if(k==='spline'){if(typeof v!=='boolean')add(w,'must be true or false')}
    else if(k==='opts'||k==='cushion'){if(!isObj(v))add(w,'must be an object')}}};
  const walk=(list,at,w)=>{if(!Array.isArray(list))return add(at,'must be a list of steps');
    list.forEach((st,i)=>{const a=at+'['+i+']';if(!isObj(st))return add(a,'a step is an object');
      const kind=kindOf(st),present=[].concat(...Object.values(KEY)).filter(k=>has(st,k));
      if(!kind)return add(a,present.length?'has '+present.join(' and ')+': a step does one thing':'a step needs one of: path, paths, shape, at, dots, flow, dry, do');
      const ok=KEY[kind].concat(F[kind],COMMON);for(const k of Object.keys(st))if(!ok.includes(k))add(a,unknownKey(k,ok)+(WITH.includes(k)?' — a '+kind+' step does not take it':''));
      if(st.name!==undefined&&typeof st.name!=='string')add(a+'.name','must be text');
      if(st.seed!==undefined&&!num(st.seed))add(a+'.seed','must be a number');
      const own={};for(const k of F[kind])if(has(st,k)&&k!=='with')own[k]=st[k];fields(a,own);
      const eff=k=>st[k]!==undefined&&st[k]!==null?st[k]:w[k];
      if(kind==='group'){if(st.with!==undefined){if(!isObj(st.with))return add(a+'.with','must be an object of shared fields');
          for(const k of Object.keys(st.with))if(!WITH.includes(k))add(a+'.with',unknownKey(k,WITH));fields(a+'.with',st.with)}
        walk(st.do,a+'.do',Object.assign({},w,st.with))}
      else if(kind==='stroke'){if(has(st,'path')&&has(st,'paths'))add(a,'has path and paths: use one');
        let min=2;try{if(P.brush(eff('brush')||'round').kind==='spray')min=1}catch(e){}
        const one=(p,b)=>{if(!Array.isArray(p)||p.length<min)return add(b,'a path is a list of at least '+min+' point'+(min>1?'s':'')+' [x, y]');const bad=p.findIndex(q=>!isPt(q));if(bad>=0)add(b,'point '+(bad+1)+' is not [x, y]')};
        if(has(st,'path'))one(st.path,a+'.path');else if(!Array.isArray(st.paths)||!st.paths.length)add(a+'.paths','must be a list of paths');else st.paths.forEach((p,j)=>one(p,a+'.paths['+j+']'))}
      else if(kind==='fill'){try{shapePolys(st.shape,doc.shapes)}catch(e){add(a+'.shape',e.message)}}
      else if(kind==='dot'){if(has(st,'at')&&has(st,'dots'))add(a,'has at and dots: use one');const r=eff('r');
        if(has(st,'at')){if(!isPt(st.at))add(a+'.at','must be [x, y]');if(!(num(r)&&r>0))add(a,'a dot needs r, its radius')}
        else if(!Array.isArray(st.dots)||!st.dots.length)add(a+'.dots','must be a list of [x, y] or [x, y, r]');
        else st.dots.forEach((d,j)=>{if(!isPt(d))add(a+'.dots['+j+']','must be [x, y] or [x, y, r]');else if(!(num(d[2])?d[2]>0:num(r)&&r>0))add(a+'.dots['+j+']','has no radius: give [x, y, r] or an r for the step')})}
      else if(kind==='flow'){if(!(num(st.flow)&&st.flow>=0))add(a+'.flow','must be a number: 1 is about the time a wet sheet takes to dry')}
      else if(kind==='dry'){if(!(st.dry===true||st.dry==='still'||(num(st.dry)&&st.dry>=0&&st.dry<=1)))add(a+'.dry','must be true, "still" (at once, nothing moves) or an amount from 0 to 1')}})};
  P.within(isObj(defs)?defs:null,()=>{
    for(const k of Object.keys(defs||{}))if(DEFINE[k]&&isObj(defs[k]))for(const n of Object.keys(defs[k]))recipe('define.'+k+'["'+n+'"]',DEFINE[k],defs[k][n]);
    if(doc.ground!==undefined)recipe('ground','ground',doc.ground);
    if(doc.light!==undefined)recipe('light','light',doc.light);
    if(doc.shapes!==undefined){if(!isObj(doc.shapes))add('shapes','must be an object of name: shape');else for(const n of Object.keys(doc.shapes)){try{shapePolys(n,doc.shapes)}catch(e){add('shapes["'+n+'"]',e.message)}}}
    if(doc.steps===undefined)add('steps','missing: the list of what is painted, in order');else walk(doc.steps,'steps',{})});
  return out}

/* ---------- open: a painting ready to be painted, one step at a time ---------- */
function open(doc,opts){opts=opts||{};
  if(!opts.unchecked){const pr=check(doc);if(pr.length)throw new Error('PaintSim: this painting has '+pr.length+' problem'+(pr.length>1?'s':'')+':\n  - '+pr.slice(0,12).join('\n  - ')+(pr.length>12?'\n  - … and '+(pr.length-12)+' more':''))}
  const seed0=(doc.seed===undefined?1:doc.seed)|0,shapes=doc.shapes||{},masks=new Map(),ops=[],stages=[];
  const surface=P.create({canvas:opts.canvas,width:doc.size[0],height:doc.size[1],scale:opts.scale||2,ground:doc.ground||'vellum',light:opts.light||doc.light,seed:seed0,define:doc.define});
  // lay the nested steps out flat, each with its shared fields filled in. Every stage starts from its own random seed,
  // so that changing one stage does not disturb the accidents of the others.
  let pending=null;const push=op=>{if(pending!==null){op.seed=pending;pending=null}ops.push(op)};
  const pick=(w,st,list)=>{const o={};for(const k of list){const v=st[k]!==undefined?st[k]:w[k];if(v!==undefined&&v!==null)o[k]=v}return o};
  const flat=(list,at,w,top)=>list.forEach((st,i)=>{if(st.hide)return;const a=at+'['+i+']',from=ops.length,kind=kindOf(st);
    if(st.seed!==undefined)pending=st.seed|0;else if(top)pending=(Math.imul(seed0,7919)+Math.imul(i+1,104729))|0;
    if(kind==='group')flat(st.do,a+'.do',Object.assign({},w,st.with),false);
    else if(kind==='stroke'){const cmd=pick(w,st,F.stroke);for(const p of st.paths||[st.path])push({k:'paint',cmd,path:p,at:a})}
    else if(kind==='fill')push({k:'fill',cmd:pick(w,st,F.fill),shape:st.shape,at:a});
    else if(kind==='dot'){const cmd=pick(w,st,F.dot);for(const d of st.dots||[st.at])push({k:'dot',cmd,d,at:a})}
    else push({k:kind,v:st[kind],at:a});
    if(top)stages.push({name:st.name||kind+' '+(i+1),from,to:ops.length})});
  flat(doc.steps,'steps',{},true);
  if(opts.upTo!==undefined){const i=typeof opts.upTo==='number'?opts.upTo:stages.findIndex(s=>s.name===opts.upTo);if(!stages[i])throw new Error('PaintSim: no stage '+JSON.stringify(opts.upTo)+' in this painting');ops.length=stages[i].to;stages.length=i+1}
  const maskOf=spec=>{const key=typeof spec==='string'?'#'+spec:JSON.stringify(spec);let m=masks.get(key);if(m===undefined){m=surface.polyMask(shapePolys(spec,shapes));masks.set(key,m)}return m};
  function exec(op){if(op.seed!==undefined)surface.reseed(op.seed);
    switch(op.k){
      case'paint':{const c=Object.assign({},op.cmd,{path:op.path});if(c.clip!==undefined)c.clip=maskOf(c.clip);surface.paint(c);break}
      case'fill':{const c=Object.assign({},op.cmd,{shape:shapePolys(op.shape,shapes)});if(c.clip!==undefined)c.clip=maskOf(c.clip);surface.fill(c);break}
      case'dot':surface.dot(Object.assign({},op.cmd,{at:[op.d[0],op.d[1]],r:op.d[2]===undefined?op.cmd.r:op.d[2]}));break;
      case'flow':surface.flow(op.v);break;
      case'dry':if(op.v==='still')surface.dry(1,true);else surface.dry(op.v===true?1:op.v);break}}
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const player={surface,painting:doc,stages,total:ops.length,at:0,
    get done(){return player.at>=ops.length},
    get stage(){const i=stages.findIndex(s=>player.at<s.to);return i<0?stages.length-1:i},
    // one step. After the last one the picture is left to dry, because a painting is photographed dry
    next(){if(player.at>=ops.length)return false;const op=ops[player.at];
      try{exec(op)}catch(e){e.message='PaintSim: '+op.at+': '+String(e.message).replace(/^PaintSim: /,'');throw e}
      if(++player.at>=ops.length){surface.dry();return false}return true},
    run(n){for(let i=0;i<n&&player.next();i++);return!player.done},
    runFor(ms){const t=now()+ms;while(player.next()&&now()<t);return!player.done},
    finish(){while(player.next());return surface}};
  return player}

function render(doc,opts){const s=open(doc,opts).finish();s.render();return s}

P.FORMAT=FORMAT;P.check=check;P.open=open;P.render=render;P.shape=(spec,shapes)=>shapePolys(spec,shapes||{});
})(PaintSim);
