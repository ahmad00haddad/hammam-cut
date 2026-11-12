from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
f=TTFont("pf700.woff"); gs=f.getGlyphSet(); cmap=f.getBestCmap(); U=f["head"].unitsPerEm
BG="#181818";G="#dddddc";B="#641020";GOLD="#b08d57"
def glyph(ch,x,k):
    pen=SVGPathPen(gs); gs[cmap[ord(ch)]].draw(TransformPen(pen,(k,0,0,-k,x,0))); return pen.getCommands(), gs[cmap[ord(ch)]].width*k
def word(size,track=0.0,crossbar_blade=False,col=G):
    k=size/U; x=0; out=[]; parts=[]
    for ch in "H&M":
        d,w=glyph(ch,x,k)
        if ch=="H" and crossbar_blade:
            # remove hairline crossbar: rebuild H without it via mask-free trick: draw H, then cover gap by clip below
            parts.append(("H",d,x))
        else: parts.append((ch,d,x))
        x+=w+track*size
    return parts, x-track*size, k
def razor(gold=False,sc=1.0):
    edge = GOLD if gold else B
    return f'''<g transform="translate(112 170) scale({sc})">
<g transform="rotate(-16)"><path fill="{B}" stroke="{GOLD if gold else G}" stroke-width="2.5" d="M-72 -8Q-72 -10 -69 -10H2V10H-69Q-72 10 -72 8Z"/><path fill="{G}" d="M-72 -8Q-72 -10 -69 -10H-60V10H-69Q-72 10 -72 8Z"/><path fill="{G}" d="M-12 -10H2V10H-12Z"/></g>
<path fill="{G}" d="M0 -10H96Q108 -10 112 0L104 11H0Z"/><path fill="{edge}" d="M10 5.5H102L104 11H10Z"/>
<circle r="8.5" fill="{G}"/><circle r="3.4" fill="{BG}"/></g>'''
def svg(body,frame=False,rounded=True):
    fr=f'<rect x="12" y="12" width="232" height="232" rx="46" fill="none" stroke="{GOLD}" stroke-width="1.6" opacity=".8"/>' if frame else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="{BG}"/>{fr}{body}</svg>'
def text(size,base,track=0.02,blade=False,gold=False,col=G):
    parts,w,k=word(size,track,blade); tx=128-w/2
    s=""
    for ch,d,x in parts:
        if blade and ch=="H":
            # H without crossbar: mask
            mid=f'<mask id="m"><rect x="-10" y="-300" width="400" height="400" fill="#fff"/><rect x="{268*k+x-0.5:.2f}" y="{-366*k-2:.2f}" width="{(533-268)*k+1:.2f}" height="{(366-346)*k+4:.2f}" fill="#000"/></mask>'
            s+=f'{mid}<path fill="{col}" mask="url(#m)" transform="translate({tx:.1f} {base})" d="{d}"/>'
            # blade in gap
            bx=tx+268*k+x; bw=(533-268)*k; by=base-356*k
            edge=GOLD if gold else B
            s+=f'<g transform="translate({bx-0.6:.2f} {by:.2f})"><path fill="{col}" d="M0 -3.2H{bw-4:.2f}Q{bw+0.6:.2f} -3.2 {bw+0.6:.2f} 0L{bw-2.5:.2f} 4H0Z"/><path fill="{edge}" d="M1.5 1.4H{bw-2.8:.2f}L{bw-2.5:.2f} 4H1.5Z"/></g>'
        else:
            s+=f'<path fill="{col}" transform="translate({tx:.1f} {base})" d="{d}"/>'
    return s
V={}
V["1-type"]=svg(text(80,120)+razor())
V["2-blade-crossbar"]=svg(text(84,128+354*0.084,0.0,blade=True)+f'<path fill="{GOLD}" d="M0 0"/>')
V["3-gold"]=svg(text(80,120)+razor(gold=True))
V["4-frame"]=svg(text(80,120)+razor(),frame=True)
V["5-mono-only"]=svg(text(84,128+354*0.084),frame=True)
V["6-all"]=svg(text(88,122,blade=False)+razor(gold=True),frame=True)
V["7-blade+gold+frame"]=svg(text(84,128+354*0.084,0.0,blade=True,gold=True),frame=True)
V["8-arabic"]=svg(text(84,104,0.0,blade=True,gold=True)+f'<text x="128" y="190" text-anchor="middle" font-size="46" font-family="\'Sakkal Majalla\',\'Traditional Arabic\',\'Segoe UI\',serif" fill="{GOLD}">همام</text>',frame=True)
for k,v in V.items(): open(f"v{k}.svg","w",encoding="utf8").write(v)
