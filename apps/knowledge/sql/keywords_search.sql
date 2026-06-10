SELECT
    paragraph_id,
	comprehensive_score,
	comprehensive_score as similarity
FROM
	(
	SELECT DISTINCT ON
		("paragraph_id") ( GREATEST(strict_similarity, relaxed_similarity) ),* ,
		GREATEST(strict_similarity, relaxed_similarity) AS comprehensive_score
	FROM
		(
		SELECT
			*,
			ts_rank_cd(embedding.search_vector, websearch_to_tsquery('simple', %s), 32) AS strict_similarity,
			ts_rank_cd(embedding.search_vector, to_tsquery('simple', %s), 32) AS relaxed_similarity
		FROM embedding ${keywords_query}) TEMP
	ORDER BY
		paragraph_id,
		GREATEST(strict_similarity, relaxed_similarity) DESC
	) DISTINCT_TEMP
WHERE comprehensive_score>%s
ORDER BY comprehensive_score DESC
LIMIT %s
