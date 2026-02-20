package com.hedgelab.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI hedgeLabOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("HedgeLab CTRM API")
                .description("Institutional Commodity Trading and Risk Management platform")
                .version("1.0.0")
                .contact(new Contact().name("HedgeLab").email("api@hedgelab.com"))
                .license(new License().name("Proprietary")));
    }
}
