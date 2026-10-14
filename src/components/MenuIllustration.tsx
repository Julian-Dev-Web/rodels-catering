// Original vector artwork: dish illustrations, not photographs of a served menu.
export function MenuIllustration({ dishes }: { dishes: number }) {
  const count = Math.max(3, Math.min(6, dishes))
  const colors = ['#9b4b32', '#d19b3b', '#5e8051', '#b65d45', '#b87929', '#648661']
  return <svg className="menu-illustration" viewBox="0 0 360 210" role="img" aria-label={`Illustration of ${count} food dishes with rice`}>
    <rect width="360" height="210" fill="#f3ecdf" />
    <path d="M0 168Q90 122 180 172T360 148V210H0Z" fill="#e5d6bf" />
    <ellipse cx="180" cy="110" rx="76" ry="65" fill="#ded3c1" />
    <ellipse cx="180" cy="103" rx="73" ry="62" fill="#fffdf8" stroke="#c9b393" strokeWidth="2" />
    <ellipse cx="180" cy="103" rx="59" ry="48" fill="#faf6eb" stroke="#e9dfcd" />
    <path d="M147 117Q145 78 180 77Q215 78 213 117Z" fill="#ece0ba" />
    <path d="M152 113Q152 82 180 82Q208 82 208 113Z" fill="#fffdf4" />
    {[161,172,183,194].map((x) => <path key={x} d={`M${x} 92l2 5m-3 7l3 4`} stroke="#ded2aa" strokeWidth="2" strokeLinecap="round" />)}
    {Array.from({length:count}, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2
      const x = 180 + Math.cos(angle) * 126, y = 106 + Math.sin(angle) * 69
      return <g key={i} transform={`translate(${x} ${y})`}>
        <ellipse cy="5" rx="37" ry="27" fill="#c8b699" opacity=".35" />
        <ellipse rx="36" ry="26" fill="#fffdf8" stroke="#c9b393" strokeWidth="1.5" />
        <ellipse rx="27" ry="18" fill={colors[i]} opacity=".25" />
        {[-12,0,12].map((offset, j) => <ellipse key={j} cx={offset} cy={j === 1 ? -4 : 3} rx="9" ry="7" fill={colors[i]} transform={`rotate(${j * 15})`} />)}
        <path d="M-15-10q9-9 16 0M9 9q6-9 15-5" fill="none" stroke="#44613c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="-5" cy="10" r="3" fill="#e6af57" />
      </g>
    })}
    <path d="M162 147q18 8 36 0" fill="none" stroke="#987654" strokeWidth="2" />
  </svg>
}
