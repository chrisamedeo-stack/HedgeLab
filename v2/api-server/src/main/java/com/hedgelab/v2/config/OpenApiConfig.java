package com.hedgelab.v2.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI hedgeLabV2OpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("HedgeLab v2 CTRM API")
                .description("Commodity Trading and Risk Management platform — v2")
                .version("2.0.0")
                .contact(new Contact().name("HedgeLab").email("api@hedgelab.com"))
                .license(new License().name("Proprietary")));
    }
}
