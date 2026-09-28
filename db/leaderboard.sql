SELECT name, gender, score, duration AS duration_seconds, npc_count, answered, mistakes
FROM scores
WHERE mode = 'full' AND rules_version = 2
ORDER BY score DESC, duration ASC, created_at ASC
LIMIT 50;
