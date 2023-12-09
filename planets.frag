#define PI 3.14159
#define STEPS 128
#define MAX_MARCH 100.0
#define HIT_DISTANCE 0.01

#define LIGHT_DIRECTION normalize(vec3(0.8, 1, 1))
#define LIGHT_COLOR vec3(1, 1, 0.8)
#define AMBIENT 0.1

#define DISTANCE 24.0

#define PIXEL_SIZE 1.0

struct Planet {
    vec3 position;
    float size;
    vec3 rotation;
    vec3[5] palette;
    float[4] levels;
    float weight;
    float offset;
};

const vec3[5]  EARTH_COLORS =  vec3[] (vec3(72, 74, 119), vec3(77, 101, 180), vec3(35, 144, 99), vec3(30, 188, 115),
                                        vec3(255, 255, 255));
const float[4] EARTH_LEVELS = float[] (0.35, 0.45, 0.53, 0.63);

const vec3[5]  MOON_COLORS =  vec3[] (vec3(69, 41, 63), vec3(107, 62, 117), vec3(127, 112, 128), vec3(155, 171, 178),
                                       vec3(255, 255, 255));
const float[4] MOON_LEVELS = float[] (0.2, 0.35, 0.4, 0.8);

#define EARTH Planet(vec3(0, 2, 0), 2.0, vec3(PI/4.0, 0.0, 0.0), EARTH_COLORS, EARTH_LEVELS, 0.4, 0.0)
#define MOON  Planet(vec3(8, 4, 0), 1.1, vec3(PI/4.0, 0.0, 0.0),  MOON_COLORS,  MOON_LEVELS, 0.3, 0.3)

#define TOTAL_PLANETS 2
Planet[TOTAL_PLANETS] PLANETS = Planet[](EARTH, MOON);

vec3[4] PALETTE = vec3[](vec3(0.6, 0.8, 0.7), vec3(0.9, 0.2, 0.2), vec3(0.2, 0.2, 0.9),
                         vec3(0.2, 0.9, 0.2));
                         
                         
mat3 rotate_x(float theta) {
    return mat3(1,           0,          0,
                0,  cos(theta), sin(theta),
                0, -sin(theta), cos(theta));;
}

mat3 rotate_y(float theta) {
    return mat3(cos(theta), 0, -sin(theta),
                         0, 1,           0,
                sin(theta), 0,  cos(theta));
}

mat3 rotate_z(float theta) {
    return mat3(cos(theta), -sin(theta), 0,
                sin(theta),  cos(theta), 0,
                         0,           0, 1);;
}

float samplePerlin(vec3 uv) {
    float[4] zoom    = float[] (0.1, 0.2, 0.6, 1.0);
    float[4] weights = float[] (0.4, 0.3, 0.2, 0.1);
    
    float value = 0.0;
    
    for (int i = 0; i < 4; i++) {
        value += texture(iChannel0, uv * zoom[i]).x * weights[i];
    }
    
    return value;
}

float samplePerlin(vec2 uv) {
    float[4] zoom    = float[] (0.1, 0.2, 0.6, 1.0);
    float[4] weights = float[] (0.4, 0.3, 0.2, 0.1);
    
    float value = 0.0;
    
    for (int i = 0; i < 4; i++) {
        value += texture(iChannel1, uv * zoom[i]).x * weights[i];
    }
    
    return value;
}

vec2 sphereUV(vec3 p) {
    vec3 n = normalize(p);
    float longitude = 0.5 - atan(n.z, n.x) / (2.0 * PI);
    float latitude = 0.5 + asin(n.y) / PI;

    vec2 uv = vec2(longitude, latitude);
    return uv;
}

float planetNoise(vec3 p, Planet planet) {
    mat3 x = rotate_x(planet.rotation.x);
    mat3 y = rotate_y(planet.rotation.y);
    mat3 z = rotate_z(planet.rotation.z);
    p = z * y * x * p;
    vec3 n = normalize(p);
    return samplePerlin(n + vec3(0, planet.offset, 0));
}

float sdPlanet(vec3 p, Planet planet) {
    vec3 n = normalize(p);
    float extra = planetNoise(p, planet);
 
    return length(p - n * extra * planet.weight) - planet.size;
}

vec2 select(vec2 d1, vec2 d2) {
    return (d1.x < d2.x) ? d1 : d2;
}

vec2 world(vec3 p) {
    vec2 res = vec2(p.y + 10.0, -1);
    
    for (int i = 0; i < TOTAL_PLANETS; i++) {
        float sphere = sdPlanet(p - PLANETS[i].position, PLANETS[i]);
        res = select(res, vec2(sphere, i));
    }

    return res;
}

vec3 get_normal(in vec3 p) {
    const vec3 s = vec3(0.1, 0.0, 0.0);

    float g_x = world(p + s.xyy).x - world(p - s.xyy).x;
    float g_y = world(p + s.yxy).x - world(p - s.yxy).x;
    float g_z = world(p + s.yyx).x - world(p - s.yyx).x;

    vec3 normal = vec3(g_x, g_y, g_z);

    return normalize(normal);
}

float specular(vec3 cam, vec3 pos, vec3 normal) {
    vec3 viewDir = normalize(cam - pos);
    vec3 reflectDir = reflect(-LIGHT_DIRECTION, normal);
    
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    return 0.5 * spec;
}

float diffuse(vec3 normal) {
    float diffuse = (dot(LIGHT_DIRECTION, normal) + 1.0) / 2.0;
    return diffuse;
}

vec4 raymarch(in vec3 ro, in vec3 rd) {
    float traveled = 0.01;
    
    vec3 p = ro;

    for (int i = 0; i < STEPS; i++) {
        p = ro + traveled * rd;
        
        vec2 world = world(p);
    
        float max_travel = world.x;
        
        if (max_travel < HIT_DISTANCE) {
            return vec4(p, world.y);
        }
        
        if (traveled > MAX_MARCH) {
            break;
        }
        
        traveled += max_travel;
    }
    return vec4(p, -1);
}

float shadow(vec3 ro, vec3 rd) {
    float traveled = 0.1;
    
    float res = 1.0;
    
    for (int i = 0; i < STEPS; i++) {
        vec2 world = world(ro + traveled * rd);
        
        float max_travel = world.x;
        
        if (max_travel < HIT_DISTANCE) {
            return 0.0;
        }
        
        res = min(res, 2.0 * max_travel / traveled);
        
        traveled += max_travel;
    }
    
    return res;
}

vec4 render(vec2 uv, float time) {
    uv *= 0.8;

    vec3 ro = vec3(cos(time) * DISTANCE, DISTANCE * 5.0 / 12.0, sin(time) * DISTANCE);
    vec3 rd = normalize(vec3(uv, 1.0));
    
    float d = PI/8.0;
    
    mat3 rx = rotate_x(d);
                  
    d = -time - PI / 2.0;
    
    mat3 ry = rotate_y(d);
                   
    rd = ry * rx * rd;
    
    vec4 march = raymarch(ro, rd);
    
    vec3 pos = march.xyz;
    vec3 normal = get_normal(pos);
    
    if (march.w < -0.1) {
        vec2 u = sphereUV(rd);
        float stars = samplePerlin(u * 120.0);
        float mult = (stars > 0.7) ? (stars - 0.4) : 0.0;
        return vec4(mult * vec3(0.6 + mult, 0.6 + mult, 0.8), 1.0);
    }
    
    Planet planet = PLANETS[int(march.w)];
    float height = planetNoise(pos - planet.position, planet);
    
    vec3 col;
    int i;
    for (i = 0; i < 4; i++) {
        if (height <= planet.levels[i]) {
            break;
        }
    }
    col = planet.palette[i] / 255.0;
    
    float lighting = diffuse(normal);
    
    if (i < 2) {
        lighting += specular(ro, pos, normal);
    }
    
    float shadow_cast = shadow(pos, LIGHT_DIRECTION);
    
    float gamma_corrected = pow(shadow_cast * lighting, 2.2);
    
    vec3 complete = max(AMBIENT, gamma_corrected) * LIGHT_COLOR * col;
    
    return vec4(complete, 1);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragCoord = floor(fragCoord / PIXEL_SIZE) * PIXEL_SIZE;
    vec2 uv = (fragCoord - iResolution.xy / 2.0) / iResolution.y;
    
    vec4 col = render(uv, iTime / 2.0);

    fragColor = col;
}


