/** Official brand glyph (simple-icons SVG in /assets/tech) tinted with the brand colour. */
export function BrandLogo({ name, color, className = 'size-7' }: { name: string; color?: string; className?: string }) {
    const url = `url(/assets/tech/${name}.svg)`;
    return (
        <span
            aria-hidden
            className={`inline-block ${className}`}
            style={{ backgroundColor: color || 'currentColor', WebkitMask: `${url} center/contain no-repeat`, mask: `${url} center/contain no-repeat` }}
        />
    );
}
