#version 300 es
precision highp float;

// Material properties - 使用与configMaterialParameters.js匹配的变量名
uniform float ambientKaStrength;    // 替代 materialAmbient
uniform float diffuseStrength;     // 替代 materialDiffuse (强度)
uniform float specularStrength;    // 替代 materialSpecular (强度)
uniform float shininess;            // 替代 materialShininess

// Light properties
uniform vec3 lightColor;            // 统一的光源颜色 (包含ambient, diffuse, specular)
uniform vec4 u_lightPosition;

// Camera and other uniforms
uniform vec3 viewPos;
uniform sampler2D diffuseTexture; // 纹理采样器
uniform sampler2D depthTexture;   // 深度纹理用于阴影

// Fog uniforms
uniform vec3 fogColor;             // 雾的颜色
uniform float fogStart;            // 雾效开始距离
uniform float fogEnd;              // 雾效结束距离

// Input from vertex shader
in vec2 TexCoord;
in vec3 FragPos;
in vec3 Normal;
in vec4 FragPosLightSpace;

out vec4 fragColor;

// Shadow calculation function
float ShadowCalculation(vec4 fragPosLightSpace) {
    // 将裁剪空间坐标转换为[0,1]范围
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;
    
    // 检查坐标是否在深度纹理范围内
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || 
        projCoords.y < 0.0 || projCoords.y > 1.0 || 
        projCoords.z < 0.0 || projCoords.z > 1.0) {
        return 0.0; // 在光源视锥体外，不产生阴影
    }
    
    // 从深度图中获取最近的深度
    float closestDepth = texture(depthTexture, projCoords.xy).r; 
    
    // 获取当前片段的深度
    float currentDepth = projCoords.z;
    
    // 计算偏置以避免阴影失真
    vec3 normal = normalize(Normal);
    vec3 lightDir;
    if (u_lightPosition.w == 1.0) {
        // 点光源
        lightDir = normalize(vec3(u_lightPosition) - FragPos);
    } else {
        // 平行光
        lightDir = normalize(vec3(u_lightPosition));
    }
    
    // 更稳健的bias计算
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    
    // 检查是否在阴影中
    if (currentDepth - bias > closestDepth) {
        return 1.0; // 在阴影中
    }
    
    return 0.0; // 不在阴影中
}

// Fog calculation function
float CalculateFogFactor() {
    // 计算片段到相机的距离
    float distance = length(FragPos - viewPos);
    
    // 线性雾效计算
    float fogFactor = (fogEnd - distance) / (fogEnd - fogStart);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    
    return fogFactor;
}

void main() {
    // 归一化法向量
    vec3 norm = normalize(Normal);
    
    // 计算光源方向
    vec3 lightDir;
    if (u_lightPosition.w == 1.0) {
        // 点光源
        lightDir = normalize(vec3(u_lightPosition) - FragPos);
    } else {
        // 平行光
        lightDir = normalize(vec3(u_lightPosition));
    }
    
    // 计算视角方向
    vec3 viewDir = normalize(viewPos - FragPos);
    // 计算反射方向
    vec3 reflectDir = reflect(-lightDir, norm);
    
    // 采样纹理颜色
    vec3 textureColor = texture(diffuseTexture, TexCoord).rgb;
    
    /* Phong shading calculation - 修改为使用configMaterialParameters.js中的参数 */
    // 环境光 (使用lightColor的强度乘以ambientKaStrength)
    vec3 ambient = lightColor * ambientKaStrength * textureColor;
    
    // 漫反射
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = lightColor * (diff * diffuseStrength) * textureColor;
    
    // 镜面反射
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = lightColor * (spec * specularStrength) * textureColor;
    
    /* Shadow calculation */
    float shadow = ShadowCalculation(FragPosLightSpace);
    
    // 合并光照结果，考虑阴影
    vec3 result = ambient + (1.0 - shadow) * (diffuse + specular);
    
    // 确保结果在合理范围内
    result = clamp(result, 0.0, 1.0);
    
    // Calculate fog factor
    float fogFactor = CalculateFogFactor();
    
    // Apply fog - mix between the calculated color and fog color based on fog factor
    vec3 finalColor = mix(fogColor, result, fogFactor);
    
    // 输出最终颜色
    fragColor = vec4(finalColor, 1.0);
    
    // 调试：如果片段完全黑色，添加一点颜色以便查看
    if (length(fragColor.rgb) < 0.05) {
        fragColor = vec4(0.2, 0.2, 0.2, 1.0); // 暗灰色
    }
}