// Diagonal hatching as an SVG <defs> element, rendered directly inside a Recharts chart,
// so a series stays distinguishable without relying on colour. Use as fill="url(#id)".
export const hatchDefs = (id, color, background = "#ffffff") => (
    <defs key={id}>
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={background} />
            <rect width="3" height="6" fill={color} />
        </pattern>
    </defs>
);
