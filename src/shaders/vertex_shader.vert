attribute vec2 a_position;
uniform vec2 u_resolution;
uniform float u_radius;

void main() {
    vec2 position = a_position / u_resolution * 2.0 - 1.0;
    vec2 corner = abs(position);
    float cornerMax = max(corner.x, corner.y);
    if (cornerMax > 1.0 - u_radius / u_resolution.x) {
        position *= 1.0 - u_radius / cornerMax;
    }
    
    vec2 zeroToTwo = position * vec2(0.5, 0.5) + 0.5;
    vec2 clipSpace = zeroToTwo * 2.0 - 1.0;
    
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}
