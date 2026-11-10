db = db.getSiblingDB("spotify");

const missingRequiredFields = db.tracks.countDocuments({
    $or: [
        { track_id: { $exists: false } },
        { album_name: { $exists: false } },
        { track_name: { $exists: false } },
        { popularity: { $exists: false } },
        { duration_ms: { $exists: false } },
        { explicit: { $exists: false } },
        { track_genre: { $exists: false } },
        { artists: { $exists: false } },
        { audio_features: { $exists: false } },
        { duration_sec: { $exists: false } },
        { popularity_tier: { $exists: false } }
    ]
});

print("Documents missing at least one required field: " + missingRequiredFields);
print("All documents match the expected schema: " + (missingRequiredFields === 0));

const task1Filter = {
    "audio_features.danceability": { $gt: 0.7 },
    "audio_features.energy": { $gt: 0.7 },
    duration_ms: { $gte: 180000, $lte: 300000 }
};

const task1Result = db.tracks.find(task1Filter, {
    _id: 0,
    track_name: 1,
    artists: 1,
    duration_ms: 1,
    "audio_features.danceability": 1,
    "audio_features.energy": 1
});

print("Task 1")
print("Tracks with danceability > 0.7, energy > 0.7, and duration between 3 and 5 minutes: " + db.tracks.countDocuments(task1Filter));
task1Result.forEach((track) => printjson(track));

const task2Result = db.tracks.aggregate([
    { $group: { _id: "$track_id", artists: { $first: "$artists" }, popularity: { $first: "$popularity" } } },
    { $unwind: "$artists" },
    {
        $group: {
            _id: "$artists",
            trackCount: { $sum: 1 },
            minPopularity: { $min: "$popularity" },
            averagePopularity: { $avg: "$popularity" }
        }
    },
    {
        $match: {
            trackCount: { $gte: 3 },
            minPopularity: { $gte: 60 }
        }
    },
    { $sort: { averagePopularity: -1, _id: 1 } },
    { $limit: 20 },
    {
        $project: {
            _id: 0,
            artist: "$_id",
            trackCount: 1,
            minPopularity: { $round: ["$minPopularity", 1] },
            averagePopularity: { $round: ["$averagePopularity", 1] }
        }
    }
]).toArray();

print("Task 2")
print("Top 20 popular artists:");
task2Result.forEach((artist) => printjson(artist));


const task3Result = db.tracks.aggregate([
    {
        $group: {
            _id: "$track_genre",
            avgTempo: { $avg: "$audio_features.tempo" },
            stdDevTempo: { $stdDevPop: "$audio_features.tempo" },
            tracks: {
                $push: {
                    _id: "$_id",
                    track_name: "$track_name",
                    popularity: "$popularity",
                    artists: "$artists",
                    audio_features: {
                        tempo: "$audio_features.tempo"
                    }
                }
            }
        }
    },
    {
        $set: {
            outlierThreshold: {
                $add: ["$avgTempo", { $multiply: [2, "$stdDevTempo"] }]
            }
        }
    },
    {
        $project: {
            _id: 0,
            avg_tempo: { $round: ["$avgTempo", 1] },
            genre: "$_id",
            outlier_threshold: { $round: ["$outlierThreshold", 1] },
            outlier_tracks: {
                $sortArray: {
                    input: {
                        $filter: {
                            input: "$tracks",
                            as: "track",
                            cond: { $gt: ["$$track.audio_features.tempo", "$outlierThreshold"] }
                        }
                    },
                    sortBy: { "audio_features.tempo": -1 }
                }
            }
        }
    },
    { $match: { "outlier_tracks.0": { $exists: true } } },
    { $sort: { genre: 1 } }
]).toArray();

print("Task 3")
print("Tracks with unusually high tempo for their genre:");
task3Result.forEach((genre) => printjson(genre));

const task4Result = db.tracks.find(
    {
        "audio_features.loudness": { $lt: -10 },
        "audio_features.speechiness": { $lt: 0.1 },
        "audio_features.instrumentalness": { $gt: 0.5 },
        explicit: false
    },
    {
        _id: 0,
        track_id: 1,
        track_name: 1,
        artists: 1,
        "audio_features.loudness": 1,
        "audio_features.speechiness": 1,
        "audio_features.instrumentalness": 1,
        explicit: 1
    }
).sort({ "audio_features.loudness": 1, track_name: 1 });

print("Task 4")
print("Tracks suitable for background listening while working:");
task4Result.forEach((track) => printjson(track));