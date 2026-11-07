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

#### Команда з частини 3:

```
mongosh "<MONGO_URI>" --file queries/part3_indexes.js
```

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

Питання: Чому виконавці зберігаються як масив, а не як рядок? Які запити стають простішими?

### Питання 2:

Чому виконавці зберігаються як масив, а не як рядок? Які запити стають простішими?

### Відповідь:

Пошук по виконавцям значно спрощується, тому що немає потреби використовувати регулярні вирази, які легко дають хибні збіги. MongoDB має нативну функціональність, яка дозволяє працювати з масивами (на приклад, знаходити одне або більше значеннь в масиві, тощо).





