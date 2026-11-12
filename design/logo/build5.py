import re
src=open("build.py").read()
RAZ=re.search(r"    razor=f'''(.*?)'''",src,re.S).group(1).replace("translate(112 170)","translate(-24 0)")
BG="#181818"
def icon(scale,rounded,dx=0,dy=0):
    r=' rx="56"' if rounded else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>H&amp;M razor</title><rect width="256" height="256"{r} fill="{BG}"/><g transform="translate({128+dx} {128+dy}) rotate(-35) scale({scale})">{RAZ}</g></svg>'
import sys
dx,dy=float(sys.argv[1]),float(sys.argv[2])
open("razor-icon.svg","w").write(icon(1.45,True,dx,dy))
open("razor-icon-maskable.svg","w").write(icon(1.15,False,dx*0.8,dy*0.8))
