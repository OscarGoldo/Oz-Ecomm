/**
 * Pana, la mascota, saludando. Es el mismo dibujo de marketing/mascota
 * (pana-saludo.svg), pero dentro de la página y no como imagen, por dos cosas:
 *
 *  - Lleva un borde claro alrededor de toda la silueta, como una calcomanía
 *    troquelada. Sobre el fondo noche del cierre su pico (casi negro) se
 *    perdía; con el borde se recorta, y combina con las calcomanías amarillas
 *    de los titulares.
 *  - Sus alas son grupos propios (`pana-ala`), así puede aletear cuando llega
 *    volando (ver `data-reveal-kind="fly"` en globals.css).
 *
 * Se usa una sola vez por página: los ids del filtro y del recorte son fijos.
 */
export function Pana({ className }: { className?: string }) {
  return (
    <svg viewBox="30 50 340 380" aria-hidden="true" className={className}>
      <defs>
        <clipPath id="pana-cuerpo">
          <ellipse cx={186} cy={300} rx={70} ry={90} />
        </clipPath>
        <filter id="pana-borde" x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius={5} result="silueta" />
          <feFlood floodColor="#F3F7FB" />
          <feComposite in2="silueta" operator="in" result="borde" />
          <feMerge>
            <feMergeNode in="borde" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* La sombra en el piso queda afuera del borde */}
      <ellipse cx={186} cy={404} rx={86} ry={9} fill="#000000" opacity={0.3} />

      <g filter="url(#pana-borde)">
        {/* Cola */}
        <g transform="translate(156 358) rotate(152)">
          <path d="M 0,-17 C 40,-19 92,-10 128,0 C 92,10 40,19 0,17 Z" fill="#0369A1" />
          <path d="M 20,0 L 110,0" stroke="#0284C7" strokeWidth={3} strokeLinecap="round" />
        </g>

        {/* Ala de atrás */}
        <g className="pana-ala pana-ala-atras" style={{ transformOrigin: "168px 250px" }}>
          <g transform="translate(168 250) rotate(112)">
            <Ala />
          </g>
        </g>

        {/* Patas */}
        <g fill="#64748B">
          <ellipse cx={168} cy={392} rx={13} ry={7} />
          <ellipse cx={206} cy={392} rx={13} ry={7} />
        </g>

        {/* Cuerpo y barriga */}
        <ellipse cx={186} cy={300} rx={70} ry={90} fill="#0EA5E9" />
        <ellipse cx={212} cy={316} rx={54} ry={80} fill="#FBBF24" clipPath="url(#pana-cuerpo)" />

        {/* Ala de adelante, la que saluda */}
        <g className="pana-ala pana-ala-frente" style={{ transformOrigin: "206px 252px" }}>
          <g transform="translate(206 252) rotate(-28)">
            <Ala />
          </g>
        </g>

        {/* Cabeza: la etiqueta del logo */}
        <g transform="translate(238.4 129.6) rotate(-45)">
          <path
            d="M -120,-60 L 0,-60 L 26,-34 L 26,34 L 0,60 L -120,60 Z"
            fill="#0EA5E9"
            stroke="#0EA5E9"
            strokeWidth={22}
            strokeLinejoin="round"
          />
          <ellipse cx={-2} cy={6} rx={34} ry={30} fill="#FFFFFF" />
          <path d="M -24,14 Q -8,19 8,14" fill="none" stroke="#0F172A" strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
          <path d="M -22,22 Q -8,27 6,22" fill="none" stroke="#0F172A" strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
          <path d="M -18,30 Q -8,34 2,30" fill="none" stroke="#0F172A" strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
          <circle cx={4} cy={-6} r={12} fill="#0F172A" />
          <circle cx={8} cy={-10} r={4} fill="#FFFFFF" />
          {/* Pico */}
          <path d="M 22,15 L 50,19 C 62,26 62,40 50,46 C 40,50 28,48 22,44 Z" fill="#334155" />
          <path d="M 22,-38 C 56,-46 96,-26 98,10 C 99,30 88,46 72,54 C 74,38 66,24 50,19 L 22,15 Z" fill="#0F172A" />
        </g>
      </g>
    </svg>
  );
}

function Ala() {
  return (
    <>
      <path
        d="M 0,-22 C 35,-30 85,-24 112,-10 C 124,-4 124,10 112,14 C 80,26 35,28 0,22 C -12,12 -12,-12 0,-22 Z"
        fill="#0284C7"
      />
      <path d="M 58,-6 L 104,-1" stroke="#7DD3FC" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <path d="M 48,8 L 96,9" stroke="#7DD3FC" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    </>
  );
}
