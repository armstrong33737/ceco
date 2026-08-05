// Wrapper léger autour de la police Material Symbols Outlined (chargée
// dans index.html). Évite de répéter la classe partout dans le code.
export default function Icon({ name, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}