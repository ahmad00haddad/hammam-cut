import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
src=open("build.py").read()
RAZ=re.search(r"    razor=f'''(.*?)'''",src,re.S).group(1)
BG="#181818";G="#dddddc";B="#641020";GOLD="#c2a265"
def txt(font,s,width,cx,cy,fill,track=0.0):
    f=TTFont(font);gs=f.getGlyphSet();cm=f.getBestCmap()
    def lay(k,t):
        x=0;it=[]
        for ch in s:
            g=gs[cm[ord(ch)]];it.append((g,x));x+=g.width*k+t
        return it,x-t
    it,w=lay(0.05,0);k=0.05*width/w;it,w=lay(k,track*width)
    # vertical center from bounds of all glyphs
    ys=[]
    for g,x in it:
        bp=BoundsPen(gs);g.draw(bp)
        if bp.bounds: ys+=[bp.bounds[1],bp.bounds[3]]
    mid=(min(ys)+max(ys))/2*k
    pen=SVGPathPen(gs)
    for g,x in it: g.draw(TransformPen(pen,(k,0,0,-k,cx-w/2+x,cy+mid)))
    return f'<path fill="{fill}" d="{pen.getCommands()}"/>'
def tile(body,bg=BG,defs=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs>{defs}<clipPath id="t"><rect width="256" height="256" rx="56"/></clipPath></defs><g clip-path="url(#t)"><rect width="256" height="256" fill="{bg}"/>{body}</g></svg>'
raz=RAZ.replace("translate(112 170)","translate(-24 0)")
out={}
# A razor hero
out["a-razor-hero"]=tile(f'<g transform="translate(128 112) rotate(-28) scale(1.28)">{raz}</g>'+txt("fonts/montserrat.woff","H&M",96,128,206,G,0.12))
# B monoline shared-stem monogram
sw=9
out["b-monoline"]=tile(f'<g fill="none" stroke="{GOLD}" stroke-width="{sw}" stroke-linejoin="miter"><path d="M84 70V186M128 70V186M172 70V186M84 128H128M128 70L150 128L172 70"/></g><circle cx="128" cy="128" r="104" fill="none" stroke="{GOLD}" stroke-width="2" opacity=".7"/>',bg=B)
# C bold sans + slash
out["c-bold-sans"]=tile(f'<path d="M-10 214L266 98V280H-10Z" fill="{BG}"/><path d="M-10 214L266 98" stroke="{G}" stroke-width="3"/>'+txt("fonts/montserrat.woff","H&M",176,128,104,G,0.0),bg=B)
# D pole stripes + plaque
st="".join(f'<path d="M{-60+i*56} 300L{240+i*56} -60H{268+i*56}L{-32+i*56} 300Z" fill="{c}"/>' for i,c in [(0,B),(1,G),(2,B),(3,G),(4,B),(5,G),(6,B)])
out["d-pole-plaque"]=tile(st+f'<rect x="38" y="84" width="180" height="88" rx="14" fill="{BG}"/><rect x="44" y="90" width="168" height="76" rx="9" fill="none" stroke="{GOLD}" stroke-width="1.6"/>'+txt("fonts/cinzel.woff","H&M",128,128,128,G,0.04),bg=G)
# E script signature
out["e-script"]=tile(txt("fonts/great-vibes.woff","H&M",170,128,112,GOLD,0.0)+f'<g transform="translate(128 196) scale(.62)">{raz.replace("translate(-24 0)","translate(-20 0)")}</g>')
# F seal
out["f-seal"]=tile(f'<circle cx="128" cy="128" r="112" fill="none" stroke="{G}" stroke-width="2.5"/><circle cx="128" cy="128" r="100" fill="none" stroke="{G}" stroke-width="1"/><circle cx="128" cy="128" r="64" fill="none" stroke="{G}" stroke-width="1"/><defs><path id="r" d="M128 128m-82 0a82 82 0 1 1 164 0a82 82 0 1 1 -164 0"/></defs><text font-size="14" font-family="Arial,sans-serif" font-weight="700" letter-spacing="3.4" fill="{G}"><textPath href="#r">BARBER SHOP ✦ IRBID ✦ BARBER SHOP ✦ IRBID ✦</textPath></text>'+txt("fonts/cinzel.woff","H&M",74,128,124,G,0.03)+f'<g transform="translate(128 150) scale(.26)">{raz.replace("translate(-24 0)","translate(-24 0)")}</g>',bg=B)
for k,v in out.items(): open(f"g-{k}.svg","w",encoding="utf8").write(v)
