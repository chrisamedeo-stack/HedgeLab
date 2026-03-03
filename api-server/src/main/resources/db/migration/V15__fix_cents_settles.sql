-- V15: Fix settle prices that were stored in ¢/bu after V13 conversion.
-- The refreshPrices() API path was storing raw cents from the external API
-- without converting to $/bu. Any price_per_bushel > 20 is clearly in cents
-- (corn ~$3-7, soybeans ~$9-15 — nothing trades at $20+/bu).

UPDATE corn_daily_settles
   SET price_per_bushel = price_per_bushel / 100
 WHERE price_per_bushel > 20;
