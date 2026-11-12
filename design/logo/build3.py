import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
src=open("build.py").read()
razor=re.search(r"    razor=f'''(.*?)'''",src,re.S).group(1)
BG="#181818";G="#dddddc"
fonts={"times":"C:/Windows/Fonts/timesbd.ttf","bodoni":"fonts/bodoni-moda.woff","cormorant":"fonts/cormorant-garamond.woff","cinzel":"fonts/cinzel.woff","libre-bodoni":"fonts/libre-bodoni.woff","dm-serif":"fonts/dm-serif-display.woff","marcellus":"fonts/marcellus.woff","caslon":"fonts/libre-caslon-text.woff"}
for n,p in fonts.items():
    f=TTFont(p); gs=f.getGlyphSet(); cm=f.getBestCmap()
    def layout(k,track):
        x=0;items=[]
        for ch in "H&M":
            g=gs[cm[ord(ch)]]; items.append((g,x)); x+=g.width*k+track
        return items,x-track
    k=0.05
    items,w=layout(k,0)
    k=k*150/w; items,w=layout(k,0.01*150)
    bp=BoundsPen(gs); gs[cm[ord("H")]].draw(bp); hb=bp.bounds
    base=118+hb[1]*k  # bottom of H at y=118
    pen=SVGPathPen(gs)
    for g,x in items: g.draw(TransformPen(pen,(k,0,0,-k,128-w/2+x,base)))
    r=razor
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="{BG}"/><path fill="{G}" d="{pen.getCommands()}"/>{r}</svg>'
    open(f"f-{n}.svg","w").write(svg)
