db = db.getSiblingDB("spotify");

const indexName = "track_genre_popularity_danceability";

if (db.tracks.getIndexes().some((index) => index.name === indexName)) {
    db.tracks.dropIndex(indexName);
}

const query = {
    track_genre: "pop",
    "audio_features.danceability": { $gte: 0.7 }
};

const sort = { popularity: -1 };

// План до створення індексу: очікується COLLSCAN і memory sort.
print("Execution plan without indexes:");
printjson(
    db.tracks
        .find(query)
        .sort(sort)
        .explain("executionStats")
);

// Equality-поле стоїть першим, щоб обмежити індекс до жанру pop.
// Поле сортування стоїть перед range-полем, щоб уникнути blocking SORT.
db.tracks.createIndex(
    {
        track_genre: 1,
        popularity: -1,
        "audio_features.danceability": 1
    },
    { name: indexName }
);

print("Execution plan with index " + indexName + ":");
printjson(
    db.tracks
        .find(query)
        .sort(sort)
        .explain("executionStats")
);

const workMusicIndexName = "audio_features_instrumentalness_speechiness_explicit";

if (!db.tracks.getIndexes().some((index) => index.name === workMusicIndexName)) {
    db.tracks.createIndex(
        {
            "audio_features.instrumentalness": 1,
            "audio_features.speechiness": 1,
            explicit: 1
        },
        { name: workMusicIndexName }
    );
}

const workMusicQuery = {
    "audio_features.instrumentalness": { $gte: 0.8 },
    "audio_features.speechiness": { $lte: 0.1 },
    explicit: false
};

print("Execution plan for work music search with index " + workMusicIndexName + ":");
printjson(
    db.tracks
        .find(workMusicQuery)
        .explain("executionStats")
);

print("Execution plan for work music search without index:");
db.tracks.dropIndex(workMusicIndexName);
printjson(
    db.tracks
        .find({
            track_genre: "pop",
            popularity: { $gte: 70 }
        })
        .explain("executionStats")
);
