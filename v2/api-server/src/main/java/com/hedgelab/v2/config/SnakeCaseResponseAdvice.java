package com.hedgelab.v2.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * Converts all JSON API responses from Java camelCase to snake_case.
 * This keeps the default camelCase ObjectMapper for deserialization (request bodies)
 * while ensuring responses use snake_case to match the frontend TypeScript types.
 */
@RestControllerAdvice
public class SnakeCaseResponseAdvice implements ResponseBodyAdvice<Object> {

    private final ObjectMapper snakeCaseMapper;

    public SnakeCaseResponseAdvice() {
        this.snakeCaseMapper = new ObjectMapper();
        this.snakeCaseMapper.setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
        this.snakeCaseMapper.registerModule(new JavaTimeModule());
        this.snakeCaseMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        this.snakeCaseMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Override
    public boolean supports(MethodParameter returnType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return MappingJackson2HttpMessageConverter.class.isAssignableFrom(converterType);
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType,
                                  MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        if (body == null || body instanceof String || body instanceof ProblemDetail) {
            return body;
        }
        return snakeCaseMapper.convertValue(body, Object.class);
    }
}
