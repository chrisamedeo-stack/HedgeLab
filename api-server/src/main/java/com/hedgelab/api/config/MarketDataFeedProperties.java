package com.hedgelab.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "hedgelab.market-data")
public class MarketDataFeedProperties {

    private String apiKey;
    private String baseUrl;
    private Map<String, String> symbolMap = Map.of();

    /**
     * Returns a reverse map: API symbol → internal index code.
     */
    public Map<String, String> getReverseSymbolMap() {
        var reverse = new java.util.HashMap<String, String>();
        symbolMap.forEach((indexCode, apiSymbol) -> reverse.put(apiSymbol, indexCode));
        return reverse;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
