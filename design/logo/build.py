from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
f=TTFont("C:/Windows/Fonts/timesbd.ttf"); gs=f.getGlyphSet(); cmap=f.getBestCmap()
cap=f["OS/2"].sCapHeight or 1356
def word(txt,size,track=0.0):
    k=size/f["head"].unitsPerEm; x=0; pen=SVGPathPen(gs); 
    for ch in txt:
        g=cmap[ord(ch)]
        tp=TransformPen(pen,(k,0,0,-k,x,0)); gs[g].draw(tp)
        x+=gs[g].width*k+track*size
    return pen.getCommands(), x-track*size
P=lambda *a:a
d,w=word("H&M",74,0.02)
# text: centered at 128, baseline y
def tile(content_scale=1.0, rounded=True, bg="#181818"):
    base=116; tx=128-w/2
    razor=f'''<g transform="translate(112 170)">
<g transform="rotate(-16)"><path fill="#641020" stroke="#dddddc" stroke-width="2.5" d="M-72 -8Q-72 -10 -69 -10H2V10H-69Q-72 10 -72 8Z"/><path fill="#dddddc" d="M-72 -8Q-72 -10 -69 -10H-60V10H-69Q-72 10 -72 8Z"/><path fill="#dddddc" d="M-12 -10H2V10H-12Z"/></g>
<path fill="#dddddc" d="M0 -10H96Q108 -10 112 0L104 11H0Z"/>
<path fill="#641020" d="M10 5.5H102L104 11H10Z"/>
<circle r="8.5" fill="#dddddc"/><circle r="3.4" fill="#181818"/></g>'''
    inner=f'<path fill="#dddddc" transform="translate({tx:.1f} {base})" d="{d}"/>{razor}'
    t=f'translate({128*(1-content_scale):.1f} {128*(1-content_scale):.1f}) scale({content_scale})' if content_scale!=1 else ''
    r=' rx="56"' if rounded else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>H&amp;M barber</title><rect width="256" height="256"{r} fill="{bg}"/><g transform="{t}">{inner}</g></svg>'
open("hm-icon.svg","w").write(tile())
open("hm-icon-maskable.svg","w").write(tile(0.78,False))
