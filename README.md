# Завдання 1. Аналітична платформа для музичного стрімінгового сервісу

## Як запустити

### MongoDB Atlas

1. Створіть кластер M0 на mongodb.com/atlas (AWS, найближчий регіон).
2. Database Access → створіть користувача з паролем.
3. Network Access → додайте свій IP (або 0.0.0.0/0 для розробки).
4. Connect → Drivers → скопіюйте рядок mongodb+srv://....

### `.env`

Додайте файл під назвою `.env` з таким вмістом:

```
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
```

де значення змінної `MONGO_URI` це скопійований раніше рядок.

### `dataset.csv`

Скачайте `.csv` файл з [Spotify Tracks Dataset на Kaggle](https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset) і помістіть його в репозиторії під назвою `dataset.csv`.

### `venv`

Створіть віртуальне середовище, запустивши:

```
python3 -m venv .venv
```

або:

```
python -m venv .venv
```

В другому випадку варто переконатися, що python посилається на версію 3.

Активуйте віртуальне середовище, запустивши (Windows):

```
.venv\Scripts\activate
```

або (Linux/MacOS)

```
source .venv/bin/activate
```

Встановіть потрібні пакети в даному віртуальному середовищі:

```
pip install -r requirements.txt
```

### Сам запуск

Усі команди варто виконувати з кореня репозиторія.

#### Команди з частини 1:

Команда щоб створити колекцію `tracks_raw` і заповнити її даними з `dataset.csv`:

```
python scripts/01_load_data.py
```

Команда щоб створити колекцію `tracks` і заповнити її трохи обробленими даними з `tracks_raw`:

```
mongosh "<MONGO_URI>" --file scripts/02_transform.js
```

#### Команда з частини 2:

```
mongosh "<MONGO_URI>" --file queries/part2_queries.js
```

Для зручності замість попереднього скрипту можна виконати:

```
mongosh "<MONGO_URI>" --file queries/part2_queries.js > part2_output.priv
```

щоб записати вивід скрипту у файлі. Я вибрав розширення `.priv` лише тому, що маємо файл requirements.txt, який ми не хочемо ігнорувати у `.gitignore`.

## Частина 1

Схема документа в колекції tracks:

| Поле | Тип | Походження |
|---|---|---|
| `_id` | ObjectId | Генерується заново, бо на стадії `$project` стоїть `_id: 0`, а `$out` створює нові |
| `track_id` | string | З датасету |
| `track_name`, `album_name` | string | З датасету |
| `artists` | array of string | Рядок `artists` розбито по `;` і обрізано пробіли |
| `explicit` | bool | З датасету |
| `popularity` | int | З датасету |
| `popularity_tier` | string | Обчислюване: `high` (≥ 70), `medium` (≥ 40 і < 70), `low` (< 40) |
| `duration_ms` | int | З датасету |
| `duration_sec` | double | Обчислюване: `duration_ms / 1000`, округлено до одного знака |
| `track_genre` | string | З датасету |
| `audio_features` | object | 12 вкладених полів: 9 типу double (`danceability`, `energy`, `loudness`, `speechiness`, `acousticness`, `instrumentalness`, `liveness`, `valence`, `tempo`) і 3 типу int (`key`, `mode`, `time_signature`) |

Приклад документа:

```
{
  "_id": { "$oid": "6aee11a5dc495743d8b0f84e" },
  "track_id": "5SuOikwiRyPMVoIQDJUgSV",
  "album_name": "Comedy",
  "track_name": "Comedy",
  "popularity": 73,
  "duration_ms": 230666,
  "explicit": false,
  "track_genre": "acoustic",
  "artists": ["Gen Hoshino"],
  "audio_features": {
    "danceability": 0.676,
    "energy": 0.461,
    "loudness": -6.746,
    "speechiness": 0.143,
    "acousticness": 0.0322,
    "instrumentalness": 0.00000101,
    "liveness": 0.358,
    "valence": 0.715,
    "tempo": 87.917,
    "key": 1,
    "mode": 0,
    "time_signature": 4
  },
  "duration_sec": 230.7,
  "popularity_tier": "high"
}
```

### Питання 1:

Чому аудіо-характеристики винесені в окремий об’єкт audio_features, а не зберігаються плоско? Коли таке вкладення вигідне, а коли створює проблеми?

### Відповідь: 

Таким чином об'єкти колекції краще організовані і більш читабельні, що полегшує подальшу працю з цією колекцією розробнику. До того ж, всі поля цього об'єкта описують як звучить трек і їх можна логічно відокремити від решти полів з трека. 

Таке вкладення вигідне, коли дані мають відношення 1:1 з документом, завжди читаються разом із ним, мають обмежений і стабільний розмір.

Таке вкладення може створювати проблеми, якщо:

- вкладені дані ростуть без кінця - документ може містити тільки 16 МБ даних, а оновлення стають дорогими. 
- порівняння на рівність цілого об'єкта є чутливим до порядку полів, тому треба фільтрувати по окремих полях.

### Питання 2:

Чому виконавці зберігаються як масив, а не як рядок? Які запити стають простішими?

### Відповідь:

Пошук по виконавцям значно спрощується, тому що немає потреби використовувати регулярні вирази, які легко дають хибні збіги. MongoDB має нативну функціональність, яка дозволяє працювати з масивами (на приклад, знаходити одне або більше значень в масиві, тощо).

В нашому випадку, ми змогли з легкістю зробити `$unwind: "$artists"` щоб розділити виконавців кожного треку, а потім згрупувати результат по виконавцям у запиті 2 з завдання 2. 

## Частина 2

### Запит 1

```javascript
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
```

Що робить запит: Знаходить в колекції `tracks` треки, які мають
високу танцювальність (`danceability > 0.7`), високу енергійність (`energy > 0.7`)
та тривалість від 3 до 5 хвилин (180000–300000 мс) одночасно. Запит повертає тільки вибрані поля, які ми перерахували в другому аргументі функції яка виконує даний запит.

В даному випадку, функція find() працює так, що знаходить всі документи в колекції, які задовільняють всі умови вказані в першому аргументі (task1Filter), і обмежує поля функції до тих, що вказані в другому аргументі (які мають одиничку), лише _id завжди має одиничку, тому якщо ми не хочемо його вибирати, то мусимо подати значення 0. Поля у вкладених об'єктах вибираються через подання стежки до даного поля, вживаючи крапки (на приклад `"audio_features.danceability": 1,`). 

Результат: 7311 знайдених треків.

Приклад одного з них:

```json
{
  track_name: 'Hold On - Remix',
  duration_ms: 188133,
  artists: [
    'Chord Overstreet',
    'Deepend'
  ],
  audio_features: {
    danceability: 0.755,
    energy: 0.78
  }
}
```

### Запит 2

```javascript
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
```

Що робить запит: знаходить всіх виконавців, які мають мінімум 3 треки, і всі треки якого мають популярність мінімум 60 відсотків, сортує їх за середньою популярністю і повертає перших 20 виконавців, виводячи їх імена, кількість треків, мінімальну та середню популярність, заокруглену до однієї десятої.

Пояснення кожного етапу запиту:

Етап 1.

```javascript
{ $group: { _id: "$track_id", artists: { $first: "$artists" }, popularity: { $first: "$popularity" } } },
```

Групує документи з однаковими полями track_id і повертає їх track_id, а також поля artists і popularity з першого знайденого документа з таким track_id, щоб не повертати дублікатів. Один трек у датасеті може лежати в кількох жанрах, тому без цього кроку виконавці отримали б зайві треки.

Етап 2.

```javascript
{ $unwind: "$artists" },
```

Бере дані з попереднього етапу і створює стільки копій кожного документа скільки є значень в масиву artists цього документа і до кожної копії в полі artists подає рядок з одним зі значень з масиву так, щоб всі значення з цієї масиву artists з даного документа були використані. 

Етап 3.

```javascript
{
    $group: {
        _id: "$artists",
        trackCount: { $sum: 1 },
        minPopularity: { $min: "$popularity" },
        averagePopularity: { $avg: "$popularity" }
    }
},
```

Групує дані за полем artists, яке містить ім'я одного з виконавців даного треку, для кожного виконавця рахує їх кількість (trackCount), знаходить найменшу (minPopularity) і середню (averagePopularity) популярність серед усіх його треків.

Етап 4.

```javascript
{
    $match: {
        trackCount: { $gte: 3 },
        minPopularity: { $gte: 60 }
    }
},
```

Бере набір документів з попереднього етапу і фільтрує їх так, щоб залишити лише виконавців, які мають мінімум 3 треки і всі його треки мають мінімум 60 відсотків популярності. 

Етап 5.

```javascript
{ $sort: { averagePopularity: -1, _id: 1 } },
```

Сортує результат з попереднього етапу по середній популярності в порядку спадання, а якщо популярність така сама, то сортує ще й по _id.

Етап 6.

```javascript
{ $limit: 20 },
```

Залишає лише 20 перших документів з результату попереднього етапу. 

Етап 7.

```javascript
{
    $project: {
        _id: 0,
        artist: "$_id",
        trackCount: 1,
        minPopularity: { $round: ["$minPopularity", 1] },
        averagePopularity: { $round: ["$averagePopularity", 1] }
    }
}
```

Бере результат попереднього етапу і повертає документи, які містять поля з ім'ям виконавця (artist), кількістю його треків (trackCount), популярністю його найменш популярного треку заокруглену до однієї десятої (minPopularity) та середню популярність його треків також заокруглену до однієї десятої (averagePopularity).

Результат запиту повертаємо у вигляді таблиці об'єктів за допомогою `.toArray()`.

Результат: 20 документів про найпопулярніших артистів

Приклад документу:
```
{
  trackCount: 3,
  artist: 'Harry Styles',
  minPopularity: 89,
  averagePopularity: 92
}
```

### Запит 3

```javascript
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
```

Що робить запит: знаходить всі треки, яких темп відхиляється більш ніж на два стандартних відхилення від середнього (далі буду називати це значення порогом) в позитивному напрямку для їх жанру. 

Пояснення кожного етапу запиту.

Етап 1.

```javascript
{ $group: { ... } }
```

Групує треки за жанром, видає для кожного жанру середній темп треків, стандартне відхилення темпу треків (за допомогою `$stdDevPop`), яке дозволяє знайти викиди для даних з нормальним розподілом, яких згідно статистики є приблизно 2.3%, а також всі треки в цьому жанрі з деякою інформацію про них.

Етап 2.

```javascript
{ $set: { ... } }
```

Додає поле яке містить значення порогу для кожного жанру.

Етап 3.

```javascript
{ $project: { ... } }
```

Повертає результат попереднього етапу але з заокругленнями до однієї десятої для кожного числа з цифрами після коми, а також знаходить треки яких темп перевищує поріг і сортує їх за темпом в спадаючому порядку.

Етап 4.

```javascript
{ $match: { ... } }
```

Повертає результат з попереднього етапу, але без жанрів для яких нема жодних треків яким темп перевищує поріг.

Етап 5.

```javascript
{ $sort: { ... } }
```

Сортує результат етапу 4 за жанром у зростаючому порядку.

Результат: документи з інформацією про треки з швидким для свого жанру темпом, згруповані по жанрам.

Приклад документа:

```javascript
{
  avg_tempo: 119,
  genre: 'acoustic',
  outlier_threshold: 178.5,
  outlier_tracks: [
    {
      _id: ObjectId('6aee11a5dc495743d8b0f9ce'),
      track_name: 'Fast Car',
      popularity: 61,
      artists: [
        'Boyce Avenue',
        'Kina Grannis'
      ],
      audio_features: {
        tempo: 204.961
      }
    },
    {
      _id: ObjectId('6aee11a5dc495743d8b0fa55'),
      track_name: 'Running Up That Hill (A Deal With God) - Acoustic',
      popularity: 51,
      artists: [
        'Jonah Baker'
      ],
      audio_features: {
        tempo: 203.816
      }
    },
    //...
  ]
}
```

### Запит 4

```javascript
const task4Filter = {
    "audio_features.loudness": { $lt: -10 },
    "audio_features.speechiness": { $lt: 0.1 },
    "audio_features.instrumentalness": { $gt: 0.5 },
    explicit: false
};

const task4Result = db.tracks.find(
    task4Filter,
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
```

Що робить запит: знаходить всі треки з loudness < -10 (тихі), speechiness < 0.1 (мало тексту) та instrumentalness > 0.5 (переважно інструментальні) і які не містять explicit контенту і повертає вибрані поля для кожного треку, сортує результат по гучності і назві треку для передбачуваних результатів.

Пояснення.

```javascript
{
    "audio_features.loudness": { $lt: -10 },
    "audio_features.speechiness": { $lt: 0.1 },
    "audio_features.instrumentalness": { $gt: 0.5 },
    explicit: false
},
```

Це дозволяє відфільтрувати всі треки за поданими умовами. 

```javascript
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
```

Вибирає тільки поля з одиничками і видаляє поле _id з результату.

```javascript
.sort({ "audio_features.loudness": 1, track_name: 1 });
```

Сортує результат для детермінованої відтворюваності результатів запиту. 

Результат: список з 9324 треків, які задовільняють умови, з вибраними полями.

Приклад такого треку:

```javascript
{
  track_id: '5utUKeJ2ZG9KCZbvdEzPfa',
  track_name: 'Soothing White Noise - Loopable With No Fade',
  explicit: false,
  artists: [
    'White Noise Sleep Sounds'
  ],
  audio_features: {
    loudness: -49.531,
    speechiness: 0,
    instrumentalness: 0.943
  }
}
```
