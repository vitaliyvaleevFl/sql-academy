const express = require('express');
const cors = require('cors');
const path = require('path');
const initSqlJs = require('sql.js');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const JWT_SECRET = 'super-secret-key-123';

const userDb = new sqlite3.Database('./database.sqlite');

userDb.serialize(() => {
  userDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      is_paid INTEGER DEFAULT 0
    )
  `);

  userDb.run(`
    CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER,
      task_id INTEGER,
      PRIMARY KEY (user_id, task_id)
    )
  `);
});

// ПОЛНЫЙ КАТАЛОГ ИЗ 70 ЗАДАЧ (С ПОДБОРКОЙ ТАБЛИЦ И 2 ПОДСКАЗКАМИ)
const TASKS = [
  // --- БАЗОВЫЕ ЗАПРОСЫ (25 FREE EASY) ---
  { 
    id: 1, 
    title: "1. Инвентаризация склада", 
    description: "Службе логистики нужна полная выгрузка всего каталога товаров. Напиши запрос, который выведет все колонки и все строки из таблицы products.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products", 
    hints: [
      "Используй символ '*' (звездочка) сразу после SELECT для выбора всех колонок.",
      "Укажи источник данных с помощью блока 'FROM products'."
    ] 
  },
  { 
    id: 2, 
    title: "2. Список клиентов", 
    description: "Отделу заботы о клиентах нужны только имена покупателей. Выведи колонку name из таблицы клиентов.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT name FROM customers", 
    hints: [
      "Обрати внимание на название таблицы — тебе нужна 'customers'.",
      "Укажи только одну колонку 'name' после оператора SELECT."
    ] 
  },
  { 
    id: 3, 
    title: "3. Витрина цен", 
    description: "Составь простой прайс-лист для сайта: выведи названия товаров (name) и их стоимость (price).", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT name, price FROM products", 
    hints: [
      "Чтобы выбрать несколько колонок, Перечисли их через запятую: name, price.",
      "Данные берутся из таблицы 'products'."
    ] 
  },
  { 
    id: 4, 
    title: "4. Email-адреса", 
    description: "Маркетологи формируют список адресов для сервиса рассылок. Выведи только колонку email из таблицы клиентов.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT email FROM customers", 
    hints: [
      "Запрос запрашивает только одно поле: email.",
      "Убедись, что делаешь выборку из таблицы 'customers'."
    ] 
  },
  { 
    id: 5, 
    title: "5. Дорогие товары", 
    description: "Найди все товары, цена (price) которых строго превышает 50 000 рублей. Выведи все их характеристики.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE price > 50000", 
    hints: [
      "Используй оператор фильтрации WHERE после названия таблицы.",
      "Условие фильтрации записывается как: price > 50000."
    ] 
  },
  { 
    id: 6, 
    title: "6. Бюджетные товары", 
    description: "Выведи товары с ценой меньше 5 000 рублей для раздела 'Товары недели'.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE price < 5000", 
    hints: [
      "Знак '<' отвечает за сравнение 'меньше'.",
      "Используй конструкцию WHERE price < 5000."
    ] 
  },
  { 
    id: 7, 
    title: "7. Категория Одежда", 
    description: "Менеджер категории одежного отдела просит выгрузить все товары, относящиеся к категории 'Одежда'.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE category = 'Одежда'", 
    hints: [
      "Фильтруй по колонке category.",
      "Текстовые значения в SQL необходимо заключать в одинарные кавычки: 'Одежда'."
    ] 
  },
  { 
    id: 8, 
    title: "8. Книжный отдел", 
    description: "Выведи информацию обо всех книгах из таблицы товаров (category = 'Книги').", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE category = 'Книги'", 
    hints: [
      "Используй блок WHERE category = 'Книги'.",
      "Убедись, что слово написано с заглавной буквы."
    ] 
  },
  { 
    id: 9, 
    title: "9. Столичные покупатели", 
    description: "Найди всех клиентов, проживающих в городе 'Москва'. Выведи всю информацию о них.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT * FROM customers WHERE city = 'Москва'", 
    hints: [
      "Фильтрация выполняется по полю city.",
      "Проверь, что делаешь выборку из таблицы 'customers'."
    ] 
  },
  { 
    id: 10, 
    title: "10. Клиенты из Петербурга", 
    description: "Выведи всех клиентов из города 'Санкт-Петербург'.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT * FROM customers WHERE city = 'Санкт-Петербург'", 
    hints: [
      "Используй точное название: WHERE city = 'Санкт-Петербург'.",
      "Строка пишется в одинарных кавычках."
    ] 
  },
  { 
    id: 11, 
    title: "11. Большой остаток", 
    description: "Складу нужно освободить место. Найди товары, остаток которых (stock) больше 50 штук.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE stock > 50", 
    hints: [
      "Проверяй значение в колонке stock.",
      "Запиши условие: WHERE stock > 50."
    ] 
  },
  { 
    id: 12, 
    title: "12. Скоро закончатся", 
    description: "Отделу закупок нужен список товаров, которых на складе осталось меньше 10 штук.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE stock < 10", 
    hints: [
      "Используй знак '<' для проверки количества.",
      "Напиши WHERE stock < 10."
    ] 
  },
  { 
    id: 13, 
    title: "13. Доступный диапазон", 
    description: "Выведи названия и цены товаров, стоимость которых находится в диапазоне от 1 000 до 5 000 рублей.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT name, price FROM products WHERE price BETWEEN 1000 AND 5000", 
    hints: [
      "Используй удобный оператор BETWEEN x AND y для фильтрации диапазонов.",
      "Выбирай только колонки name и price."
    ] 
  },
  { 
    id: 14, 
    title: "14. Средний сегмент", 
    description: "Найди товары с ценой от 10 000 до 30 000 рублей включительно.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE price BETWEEN 10000 AND 30000", 
    hints: [
      "Оператор BETWEEN включает обе границы диапазона.",
      "Запиши: WHERE price BETWEEN 10000 AND 30000."
    ] 
  },
  { 
    id: 15, 
    title: "15. Выборка категорий", 
    description: "Выведи все товары, которые относятся либо к категории 'Одежда', либо к категории 'Книги'. Используй оператор IN.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE category IN ('Одежда', 'Книги')", 
    hints: [
      "Оператор IN позволяет проверить совпадение со списком значений.",
      "Синтаксис: WHERE category IN ('Одежда', 'Книги')."
    ] 
  },
  { 
    id: 16, 
    title: "16. Клиенты региона", 
    description: "Выведи покупателей из 'Москва' и 'Казань'.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT * FROM customers WHERE city IN ('Москва', 'Казань')", 
    hints: [
      "Используй оператор IN для проверки нескольких городов.",
      " WHERE city IN ('Москва', 'Казань')."
    ] 
  },
  { 
    id: 17, 
    title: "17. Имена на букву А", 
    description: "Найди всех клиентов, чьё имя начинается с буквы 'А'.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT * FROM customers WHERE name LIKE 'А%'", 
    hints: [
      "Для поиска по шаблону используй оператор LIKE.",
      "Знак '%' заменяет любые последующие символы: 'А%'."
    ] 
  },
  { 
    id: 18, 
    title: "18. Клиенты с Mail.ru", 
    description: "Найди всех клиентов, у которых email заканчивается на '@mail.ru'.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT * FROM customers WHERE email LIKE '%@mail.ru'", 
    hints: [
      "Используй LIKE со знаком '%' в начале шаблона.",
      "Шаблон поиска: '%@mail.ru'."
    ] 
  },
  { 
    id: 19, 
    title: "19. Сортировка по убыванию", 
    description: "Отсортируй все товары по цене — от самых дорогих к самым дешевым.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products ORDER BY price DESC", 
    hints: [
      "Для сортировки добавь в конец запроса ORDER BY price.",
      "Для порядка по убыванию используй ключевое слово DESC."
    ] 
  },
  { 
    id: 20, 
    title: "20. Сортировка по возрастанию", 
    description: "Выведи товары, отсортировав их по цене от наименьшей к наибольшей.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products ORDER BY price ASC", 
    hints: [
      "Для сортировки по возрастанию применяется ключевое слово ASC.",
      "ORDER BY price ASC."
    ] 
  },
  { 
    id: 21, 
    title: "21. Топ-3 дорогих товара", 
    description: "Выведи название и цену 3 самых дорогих товаров в магазине.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT name, price FROM products ORDER BY price DESC LIMIT 3", 
    hints: [
      "Сначала отсортируй товары по убыванию цены (ORDER BY price DESC).",
      "Ограничь количество выводимых строк с помощью LIMIT 3."
    ] 
  },
  { 
    id: 22, 
    title: "22. Топ-5 дешевых товаров", 
    description: "Найди 5 самых дешевых товаров в каталоге.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT * FROM products ORDER BY price ASC LIMIT 5", 
    hints: [
      "Отсортируй данные по возрастанию цены: ORDER BY price ASC.",
      "Воспользуйся оператором LIMIT 5."
    ] 
  },
  { 
    id: 23, 
    title: "23. Свежие заказы", 
    description: "Выведи 5 самых последних созданных заказов из таблицы orders.", 
    difficulty: "easy", isFree: true, tables: ["orders"],
    correctQuery: "SELECT * FROM orders ORDER BY id DESC LIMIT 5", 
    hints: [
      "Последние заказы имеют наибольший id.",
      "Используй ORDER BY id DESC LIMIT 5."
    ] 
  },
  { 
    id: 24, 
    title: "24. Двойная сортировка", 
    description: "Выведи клиентов, отсортировав их сначала по городу (по алфавиту), а внутри одного города — по имени.", 
    difficulty: "easy", isFree: true, tables: ["customers"],
    correctQuery: "SELECT * FROM customers ORDER BY city ASC, name ASC", 
    hints: [
      "В ORDER BY можно перечислять несколько полей через запятую.",
      "ORDER BY city ASC, name ASC."
    ] 
  },
  { 
    id: 25, 
    title: "25. Все категории", 
    description: "Выведи список всех уникальных категорий товаров без повторений.", 
    difficulty: "easy", isFree: true, tables: ["products"],
    correctQuery: "SELECT DISTINCT category FROM products", 
    hints: [
      "Ключевое слово DISTINCT исключает дубликаты из результата.",
      "Напиши: SELECT DISTINCT category FROM products."
    ] 
  },

  // --- ПРОДВИНУТЫЕ БАЗОВЫЕ (10 PRO EASY) ---
  { 
    id: 26, 
    title: "26. Оценка запасов (PRO)", 
    description: "Посчитай полную стоимость запасов каждого товара. Выведи имя товара и перемножь цену (price) на количество (stock), переименовав колонку в total_value.", 
    difficulty: "easy", isFree: false, tables: ["products"],
    correctQuery: "SELECT name, (price * stock) as total_value FROM products", 
    hints: [
      "В SQL можно выполнять арифметические операции прямо в SELECT: (price * stock).",
      "Задай новое имя колонке через оператор 'as total_value'."
    ] 
  },
  { 
    id: 27, 
    title: "27. Поиск по бренду Galaxy (PRO)", 
    description: "Найди все товары, в названии (name) которых присутствует слово 'Galaxy'.", 
    difficulty: "easy", isFree: false, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE name LIKE '%Galaxy%'", 
    hints: [
      "Используй оператор LIKE для поиска фрагмента текста.",
      "Поставь знаки '%' с обеих сторон: '%Galaxy%'."
    ] 
  },
  { 
    id: 28, 
    title: "28. Региональные клиенты (PRO)", 
    description: "Выведи всех клиентов, за исключением тех, кто живет в Москве.", 
    difficulty: "easy", isFree: false, tables: ["customers"],
    correctQuery: "SELECT * FROM customers WHERE city != 'Москва'", 
    hints: [
      "Оператор 'не равно' в SQL записывается как '!=' или '<>'.",
      "WHERE city != 'Москва'."
    ] 
  },
  { 
    id: 29, 
    title: "29. Доступная электроника (PRO)", 
    description: "Найди товары из категории 'Электроника', цена которых меньше 50 000 рублей.", 
    difficulty: "easy", isFree: false, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE category = 'Электроника' AND price < 50000", 
    hints: [
      "Сочетай условия категории и цены через AND.",
      "WHERE category = 'Электроника' AND price < 50000."
    ] 
  },
  { 
    id: 30, 
    title: "30. Ограниченный остаток (PRO)", 
    description: "Найди товары, количество которых на складе находится в пределах от 10 до 20 штук включительно.", 
    difficulty: "easy", isFree: false, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE stock BETWEEN 10 AND 20", 
    hints: [
      "Используй BETWEEN для диапазона по полю stock.",
      "WHERE stock BETWEEN 10 AND 20."
    ] 
  },
  { 
    id: 31, 
    title: "31. Корпоративные почты (PRO)", 
    description: "Найди всех покупателей, у которых email НЕ заканчивается на '@gmail.com'.", 
    difficulty: "easy", isFree: false, tables: ["customers"],
    correctQuery: "SELECT * FROM customers WHERE email NOT LIKE '%@gmail.com'", 
    hints: [
      "Используй отрицание шаблона с помощью NOT LIKE.",
      "WHERE email NOT LIKE '%@gmail.com'."
    ] 
  },
  { 
    id: 32, 
    title: "32. Вторая страница каталога (PRO)", 
    description: "Выведи товары с 4-го по 6-й (пропусти первые 3 товара из базы данных).", 
    difficulty: "easy", isFree: false, tables: ["products"],
    correctQuery: "SELECT * FROM products LIMIT 3 OFFSET 3", 
    hints: [
      "Оператор OFFSET указывает, сколько строк пропустить от начала.",
      "Запиши: LIMIT 3 OFFSET 3."
    ] 
  },
  { 
    id: 33, 
    title: "33. География присутствия (PRO)", 
    description: "Получи список уникальных городов клиентов без повторяющихся значений.", 
    difficulty: "easy", isFree: false, tables: ["customers"],
    correctQuery: "SELECT DISTINCT city FROM customers", 
    hints: [
      "Используй DISTINCT перед именем колонки city.",
      "SELECT DISTINCT city FROM customers."
    ] 
  },
  { 
    id: 34, 
    title: "34. Короткие названия (PRO)", 
    description: "Отсортируй товары по длине их наименования — от самых коротких к длинным.", 
    difficulty: "easy", isFree: false, tables: ["products"],
    correctQuery: "SELECT * FROM products ORDER BY LENGTH(name) ASC", 
    hints: [
      "Встроенная функция LENGTH(name) возвращает длину строки.",
      "ORDER BY LENGTH(name) ASC."
    ] 
  },
  { 
    id: 35, 
    title: "35. Акционные товары (PRO)", 
    description: "Найди товары, которые либо относятся к 'Одежда', либо стоят дороже 80 000 рублей.", 
    difficulty: "easy", isFree: false, tables: ["products"],
    correctQuery: "SELECT * FROM products WHERE category = 'Одежда' OR price > 80000", 
    hints: [
      "Используй логическое ИЛИ — оператор OR.",
      "WHERE category = 'Одежда' OR price > 80000."
    ] 
  },

  // --- СРЕДНИЙ УРОВЕНЬ (20 PRO MEDIUM) ---
  { 
    id: 36, 
    title: "36. Общее число позиций (PRO)", 
    description: "Посчитай общее количество товаров в каталоге интернет-магазина.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT COUNT(*) FROM products", 
    hints: [
      "Воспользуйся агрегатной функцией COUNT(*).",
      "Запрос вернет одно число — количество строк в products."
    ] 
  },
  { 
    id: 37, 
    title: "37. Размер клиентской базы (PRO)", 
    description: "Узнай общее количество зарегистрированных клиентов.", 
    difficulty: "medium", isFree: false, tables: ["customers"],
    correctQuery: "SELECT COUNT(id) FROM customers", 
    hints: [
      "Примени функцию COUNT(id) или COUNT(*).",
      "Делай выборку из таблицы 'customers'."
    ] 
  },
  { 
    id: 38, 
    title: "38. Всего предметов на складе (PRO)", 
    description: "Посчитай сумму всех физических единиц товара на складе (колонка stock).", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT SUM(stock) FROM products", 
    hints: [
      "Функция SUM() складывает все значения в указанной колонке.",
      "SELECT SUM(stock) FROM products."
    ] 
  },
  { 
    id: 39, 
    title: "39. Средняя стоимость товара (PRO)", 
    description: "Рассчитай среднюю цену единицы товара по всему магазину.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT AVG(price) FROM products", 
    hints: [
      "Для подсчета среднего арифметического используй функцию AVG().",
      "SELECT AVG(price) FROM products."
    ] 
  },
  { 
    id: 40, 
    title: "40. Максимальный ценник (PRO)", 
    description: "Найди стоимость самого дорогого товара в базе данных.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT MAX(price) FROM products", 
    hints: [
      "Функция MAX() находит наибольшее значение.",
      "SELECT MAX(price) FROM products."
    ] 
  },
  { 
    id: 41, 
    title: "41. Самый бюджетный вариант (PRO)", 
    description: "Найди минимальную цену товара в ассортименте.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT MIN(price) FROM products", 
    hints: [
      "Для поиска минимального значения используется функция MIN().",
      "SELECT MIN(price) FROM products."
    ] 
  },
  { 
    id: 42, 
    title: "42. Количество по категориям (PRO)", 
    description: "Посчитай, сколько наименований товаров представлено в каждой категории.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT category, COUNT(*) FROM products GROUP BY category", 
    hints: [
      "Сочетай выборку категории и функцию COUNT(*).",
      "Обязательно добавь GROUP BY category в конце."
    ] 
  },
  { 
    id: 43, 
    title: "43. Средний чек категории (PRO)", 
    description: "Выведи список категорий и среднюю цену товаров внутри каждой из них.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT category, AVG(price) FROM products GROUP BY category", 
    hints: [
      "Используй комбинацию AVG(price) и GROUP BY category.",
      "SELECT category, AVG(price) FROM products GROUP BY category."
    ] 
  },
  { 
    id: 44, 
    title: "44. Максимальные запасы (PRO)", 
    description: "Выведи каждую категорию и максимальный остаток единиц товара (stock) в ней.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT category, MAX(stock) FROM products GROUP BY category", 
    hints: [
      "Воспользуйся функцией MAX(stock).",
      "Сгруппируй данные по категориям: GROUP BY category."
    ] 
  },
  { 
    id: 45, 
    title: "45. Распределение покупателей (PRO)", 
    description: "Посчитай число клиентов в каждом городе.", 
    difficulty: "medium", isFree: false, tables: ["customers"],
    correctQuery: "SELECT city, COUNT(*) FROM customers GROUP BY city", 
    hints: [
      "Сгруппируй клиентов по полю city.",
      "SELECT city, COUNT(*) FROM customers GROUP BY city."
    ] 
  },
  { 
    id: 46, 
    title: "46. Объемы покупок (PRO)", 
    description: "Сгруппируй заказы по их id и посчитай общую сумму купленных штук (amount).", 
    difficulty: "medium", isFree: false, tables: ["orders"],
    correctQuery: "SELECT id, SUM(amount) FROM orders GROUP BY id", 
    hints: [
      "Используй SUM(amount) и сгруппируй по id.",
      "Таблица для работы — 'orders'."
    ] 
  },
  { 
    id: 47, 
    title: "47. Крупные категории (PRO)", 
    description: "Выведи только те категории, в которых представлено больше 3 наименований товаров.", 
    difficulty: "medium", isFree: false, tables: ["products"],
    correctQuery: "SELECT category, COUNT(*) FROM products GROUP BY category HAVING COUNT(*) > 3", 
    hints: [
      "Для фильтрации ПОСЛЕ группировки используется HAVING, а не WHERE.",
      "Добавь в конец: HAVING COUNT(*) > 3."
    ] 
  },
  { 
    id: 48, 
    title: "48. Популярные города (PRO)", 
    description: "Выведи только те города, из которых зарегистрировано строго больше 1 клиента.", 
    difficulty: "medium", isFree: false, tables: ["customers"],
    correctQuery: "SELECT city, COUNT(*) FROM customers GROUP BY city HAVING COUNT(*) > 1", 
    hints: [
      "Сгруппируй по городу и отфильтруй с помощью HAVING.",
      "HAVING COUNT(*) > 1."
    ] 
  },
  { 
    id: 49, 
    title: "49. Активность по дням (PRO)", 
    description: "Посчитай количество оформленных заказов за каждую дату (order_date).", 
    difficulty: "medium", isFree: false, tables: ["orders"],
    correctQuery: "SELECT order_date, COUNT(*) FROM orders GROUP BY order_date", 
    hints: [
      "Группировка выполнятся по полю order_date.",
      "SELECT order_date, COUNT(*) FROM orders GROUP BY order_date."
    ] 
  },
  { 
    id: 50, 
    title: "50. Сопоставление заказов (PRO)", 
    description: "Соедини таблицы заказов и клиентов. Выведи номер заказа (orders.id) и имя клиента (customers.name).", 
    difficulty: "medium", isFree: false, tables: ["orders", "customers"],
    correctQuery: "SELECT o.id, c.name FROM orders o JOIN customers c ON o.customer_id = c.id", 
    hints: [
      "Используй INNER JOIN или JOIN для соединения таблиц.",
      "Условие связи: ON orders.customer_id = customers.id."
    ] 
  },
  { 
    id: 51, 
    title: "51. Детализация товара (PRO)", 
    description: "Соедини таблицы orders и products. Выведи id заказа и название купленного товара (products.name).", 
    difficulty: "medium", isFree: false, tables: ["orders", "products"],
    correctQuery: "SELECT o.id, p.name FROM orders o JOIN products p ON o.product_id = p.id", 
    hints: [
      "Присоедини таблицу products по ключу product_id.",
      "ON orders.product_id = products.id."
    ] 
  },
  { 
    id: 52, 
    title: "52. Заказы за дату (PRO)", 
    description: "Выведи имена клиентов, которые сделали заказ именно '2026-07-02'.", 
    difficulty: "medium", isFree: false, tables: ["customers", "orders"],
    correctQuery: "SELECT c.name FROM customers c JOIN orders o ON c.id = o.customer_id WHERE o.order_date = '2026-07-02'", 
    hints: [
      "Соедини customers и orders, затем добавь WHERE по дате.",
      "WHERE order_date = '2026-07-02'."
    ] 
  },
  { 
    id: 53, 
    title: "53. Покупавшие клиенты (PRO)", 
    description: "Выведи список уникальных имён клиентов, сделавших хотя бы один заказ.", 
    difficulty: "medium", isFree: false, tables: ["customers", "orders"],
    correctQuery: "SELECT DISTINCT c.name FROM customers c JOIN orders o ON c.id = o.customer_id", 
    hints: [
      "Используй JOIN для связи клиентов с их заказами.",
      "Добавь DISTINCT, чтобы имена не повторялись."
    ] 
  },
  { 
    id: 54, 
    title: "54. Проданные товары (PRO)", 
    description: "Выведи уникальные названия товаров, которые покупали хотя бы один раз.", 
    difficulty: "medium", isFree: false, tables: ["products", "orders"],
    correctQuery: "SELECT DISTINCT p.name FROM products p JOIN orders o ON p.id = o.product_id", 
    hints: [
      "Свяжи products и orders через JOIN.",
      "Примени DISTINCT к названию товара."
    ] 
  },
  { 
    id: 55, 
    title: "55. Клиент и объемы (PRO)", 
    description: "Выведи имя клиента и количество приобретенных им единиц товара (amount) по каждому его заказу.", 
    difficulty: "medium", isFree: false, tables: ["customers", "orders"],
    correctQuery: "SELECT c.name, o.amount FROM customers c JOIN orders o ON c.id = o.customer_id", 
    hints: [
      "Выбери поля customers.name и orders.amount.",
      "Свяжи таблицы по ключу customer_id."
    ] 
  },

  // --- СЛОЖНЫЙ УРОВЕНЬ (15 PRO HARD) ---
  { 
    id: 56, 
    title: "56. Полный отчет по заказу (PRO)", 
    description: "Объедини ТРИ таблицы! Выведи дату заказа, имя клиента и название купленного им товара.", 
    difficulty: "hard", isFree: false, tables: ["orders", "customers", "products"],
    correctQuery: "SELECT o.order_date, c.name, p.name FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id", 
    hints: [
      "Используй два последовательных оператора JOIN.",
      "Сначала присоедини customers, затем products."
    ] 
  },
  { 
    id: 57, 
    title: "57. Расчет чека заказа (PRO)", 
    description: "Выведи id заказа и посчитай итоговую стоимость этой позиции (количество amount умножить на цену товара price).", 
    difficulty: "hard", isFree: false, tables: ["orders", "products"],
    correctQuery: "SELECT o.id, (o.amount * p.price) FROM orders o JOIN products p ON o.product_id = p.id", 
    hints: [
      "Перемножь orders.amount на products.price.",
      "Не забудь соединить таблицы orders и products."
    ] 
  },
  { 
    id: 58, 
    title: "58. Топ-клиент по потраченным средствам (PRO)", 
    description: "Найди покупателя, принесшего больше всего денег. Выведи его имя и общую сумму его покупок.", 
    difficulty: "hard", isFree: false, tables: ["customers", "orders", "products"],
    correctQuery: "SELECT c.name, SUM(o.amount * p.price) as total FROM customers c JOIN orders o ON c.id = o.customer_id JOIN products p ON o.product_id = p.id GROUP BY c.name ORDER BY total DESC LIMIT 1", 
    hints: [
      "Соедини 3 таблицы, сгруппируй по c.name и посчитай SUM(amount * price).",
      "Отсортируй результат по убыванию суммы и ограничь вывод 1 строкой (LIMIT 1)."
    ] 
  },
  { 
    id: 59, 
    title: "59. Самый продаваемый товар (PRO)", 
    description: "Найди наименование товара, проданного в наибольшем суммарном количестве (сумма amount).", 
    difficulty: "hard", isFree: false, tables: ["products", "orders"],
    correctQuery: "SELECT p.name, SUM(o.amount) as qty FROM products p JOIN orders o ON p.id = o.product_id GROUP BY p.name ORDER BY qty DESC LIMIT 1", 
    hints: [
      "Сгруппируй продажи по названию товара и примени SUM(amount).",
      "Используй ORDER BY qty DESC LIMIT 1."
    ] 
  },
  { 
    id: 60, 
    title: "60. Доходность категорий (PRO)", 
    description: "Посчитай общую денежную выручку от продаж отдельно для каждой категории товаров.", 
    difficulty: "hard", isFree: false, tables: ["products", "orders"],
    correctQuery: "SELECT p.category, SUM(o.amount * p.price) FROM products p JOIN orders o ON p.id = o.product_id GROUP BY p.category", 
    hints: [
      "Перемножь amount на price внутри агрегатной функции SUM().",
      "Сгруппируй результат по p.category."
    ] 
  },
  { 
    id: 61, 
    title: "61. Пассивные клиенты (PRO)", 
    description: "Найди клиентов, которые еще не оформили ни одного заказа. Выведи их имена.", 
    difficulty: "hard", isFree: false, tables: ["customers", "orders"],
    correctQuery: "SELECT c.name FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE o.id IS NULL", 
    hints: [
      "Используй тип соединения LEFT JOIN, чтобы сохранить всех клиентов.",
      "Отфильтруй только тех, у кого id заказа равен NULL: WHERE o.id IS NULL."
    ] 
  },
  { 
    id: 62, 
    title: "62. Невостребованные товары (PRO)", 
    description: "Найди товары, которые ни разу не были куплены клиентами.", 
    difficulty: "hard", isFree: false, tables: ["products", "orders"],
    correctQuery: "SELECT p.name FROM products p LEFT JOIN orders o ON p.id = o.product_id WHERE o.id IS NULL", 
    hints: [
      "Примени LEFT JOIN от таблицы products к orders.",
      "Добавь условие WHERE orders.id IS NULL."
    ] 
  },
  { 
    id: 63, 
    title: "63. Выше средней цены (PRO)", 
    description: "Выведи название и цену товаров, стоимость которых выше средней цены по всему каталогу. Используй подзапрос.", 
    difficulty: "hard", isFree: false, tables: ["products"],
    correctQuery: "SELECT name, price FROM products WHERE price > (SELECT AVG(price) FROM products)", 
    hints: [
      "В блоке WHERE напиши подзапрос в скобках: (SELECT AVG(price) FROM products).",
      "Запрос выведет товары дороже найденной средней стоимости."
    ] 
  },
  { 
    id: 64, 
    title: "64. Самый дорогой предмет (PRO)", 
    description: "Найди название товара с абсолютной максимальной ценой с помощью подзапроса.", 
    difficulty: "hard", isFree: false, tables: ["products"],
    correctQuery: "SELECT name FROM products WHERE price = (SELECT MAX(price) FROM products)", 
    hints: [
      "Используй подзапрос для нахождения максимальной цены: (SELECT MAX(price) FROM products).",
      "Сравни значение колонки price с результатом подзапроса."
    ] 
  },
  { 
    id: 65, 
    title: "65. Заказы жителей столицы (PRO)", 
    description: "Выведи номера заказов (id), которые были оформлены клиентами из Москвы (через вложенный подзапрос IN).", 
    difficulty: "hard", isFree: false, tables: ["orders", "customers"],
    correctQuery: "SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE city = 'Москва')", 
    hints: [
      "Напиши подзапрос, выбирающий id клиентов из Москвы.",
      "Используй условие WHERE customer_id IN (...)."
    ] 
  },
  { 
    id: 66, 
    title: "66. Классификация товаров (PRO)", 
    description: "Выведи наименование товара и создай колонку 'type': если цена больше 30 000 — выведи 'Дорого', иначе 'Дешево'. Используй конструкцию CASE.", 
    difficulty: "hard", isFree: false, tables: ["products"],
    correctQuery: "SELECT name, CASE WHEN price > 30000 THEN 'Дорого' ELSE 'Дешево' END as type FROM products", 
    hints: [
      "Используй оператор условных ветвлений CASE WHEN ... THEN ... ELSE ... END.",
      "Назови новую колонку как 'type'."
    ] 
  },
  { 
    id: 67, 
    title: "67. Контроль остатков (PRO)", 
    description: "Выведи имя товара и категорию запаса: если stock < 20 — выведи 'Мало', иначе 'Достаточно'.", 
    difficulty: "hard", isFree: false, tables: ["products"],
    correctQuery: "SELECT name, CASE WHEN stock < 20 THEN 'Мало' ELSE 'Достаточно' END FROM products", 
    hints: [
      "Примени условие CASE WHEN stock < 20 THEN 'Мало' ELSE 'Достаточно' END.",
      "Данные берутся из таблицы products."
    ] 
  },
  { 
    id: 68, 
    title: "68. Общий доход регионов (PRO)", 
    description: "Посчитай совокупную выручку по каждому городу на основе купленных в нем товаров.", 
    difficulty: "hard", isFree: false, tables: ["customers", "orders", "products"],
    correctQuery: "SELECT c.city, SUM(p.price * o.amount) FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id GROUP BY c.city", 
    hints: [
      "Соедини 3 таблицы и сгруппируй по c.city.",
      "Для расчета используй SUM(products.price * orders.amount)."
    ] 
  },
  { 
    id: 69, 
    title: "69. Крупные рынки сбыта (PRO)", 
    description: "Выведи только те города, совокупная выручка в которых превысила 50 000 рублей.", 
    difficulty: "hard", isFree: false, tables: ["customers", "orders", "products"],
    correctQuery: "SELECT c.city, SUM(p.price * o.amount) as rev FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id GROUP BY c.city HAVING rev > 50000", 
    hints: [
      "Добавь условие HAVING rev > 50000 после группировки по городу.",
      "Задай псевдоним расчитанной сумме: as rev."
    ] 
  },
  { 
    id: 70, 
    title: "70. Самая прибыльная категория (PRO)", 
    description: "Найди категорию товаров, которая принесла больше всего денег. Выведи только её название.", 
    difficulty: "hard", isFree: false, tables: ["products", "orders"],
    correctQuery: "SELECT p.category FROM products p JOIN orders o ON p.id = o.product_id GROUP BY p.category ORDER BY SUM(o.amount * p.price) DESC LIMIT 1", 
    hints: [
      "Соедини товары и заказы, сгруппируй по p.category.",
      "Отсортируй по SUM(amount * price) DESC и возьми первую строку с помощью LIMIT 1."
    ] 
  }
];

let learningDb;

initSqlJs().then(SQL => {
  learningDb = new SQL.Database();
  learningDb.run(`
    CREATE TABLE products (id INT, name TEXT, category TEXT, price INT, stock INT);
    INSERT INTO products VALUES 
      (1, 'iPhone 15', 'Электроника', 90000, 15),
      (2, 'Samsung Galaxy S24', 'Электроника', 85000, 10),
      (3, 'Чехол для телефона', 'Аксессуары', 1500, 100),
      (4, 'Наушники AirPods', 'Электроника', 20000, 25),
      (5, 'Клавиатура', 'Аксессуары', 4500, 40),
      (6, 'Футболка', 'Одежда', 2500, 80),
      (7, 'Джинсы', 'Одежда', 4000, 60),
      (8, 'Книга "SQL за 10 минут"', 'Книги', 900, 120),
      (9, 'Книга "Чистый код"', 'Книги', 1200, 50),
      (10, 'MacBook Pro', 'Электроника', 150000, 5),
      (11, 'Рюкзак', 'Аксессуары', 3500, 30),
      (12, 'Кроссовки', 'Одежда', 7000, 45),
      (13, 'Мышь игровая', 'Аксессуары', 3000, 20),
      (14, 'Монитор 27"', 'Электроника', 25000, 12),
      (15, 'Книга "Гарри Поттер"', 'Книги', 1500, 200);

    CREATE TABLE customers (id INT, name TEXT, email TEXT, city TEXT);
    INSERT INTO customers VALUES 
      (1, 'Алексей Иванов', 'alex@mail.ru', 'Москва'),
      (2, 'Елена Петрова', 'elena@yandex.ru', 'Санкт-Петербург'),
      (3, 'Дмитрий Сидоров', 'dima@gmail.com', 'Москва'),
      (4, 'Анна Кузнецова', 'anna@mail.ru', 'Казань'),
      (5, 'Иван Смирнов', 'ivan@gmail.com', 'Новосибирск'),
      (6, 'Ольга Попова', 'olga@yandex.ru', 'Екатеринбург'),
      (7, 'Сергей Волков', 'sergey@mail.ru', 'Санкт-Петербург'),
      (8, 'Мария Лебедева', 'maria@corp.com', 'Москва'),
      (9, 'Антон Козлов', 'anton@yandex.ru', 'Казань'),
      (10, 'Юлия Новикова', 'yulia@corp.com', 'Владивосток');

    CREATE TABLE orders (id INT, customer_id INT, product_id INT, order_date TEXT, amount INT);
    INSERT INTO orders VALUES 
      (101, 1, 1, '2026-07-01', 1),
      (102, 2, 3, '2026-07-02', 2),
      (103, 1, 4, '2026-07-03', 1),
      (104, 3, 2, '2026-07-04', 1),
      (105, 4, 8, '2026-07-05', 3),
      (106, 5, 10, '2026-07-06', 1),
      (107, 6, 6, '2026-07-07', 2),
      (108, 7, 12, '2026-07-08', 1),
      (109, 8, 14, '2026-07-09', 2),
      (110, 9, 9, '2026-07-10', 1),
      (111, 1, 11, '2026-07-11', 1),
      (112, 2, 13, '2026-07-12', 1),
      (113, 3, 7, '2026-07-13', 2),
      (114, 10, 15, '2026-07-14', 5),
      (115, 8, 5, '2026-07-15', 1);
  `);
  console.log("Учебная песочница готова!");
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/tasks', (req, res) => {
  const { token } = req.body || {};
  let userId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (e) {}
  }

  const publicTasks = TASKS.map(t => ({ 
    id: t.id, 
    title: t.title, 
    description: t.description, 
    difficulty: t.difficulty, 
    isFree: t.isFree, 
    isCompleted: false, 
    hints: t.hints, 
    tables: t.tables 
  }));

  if (!userId) {
    return res.json(publicTasks);
  }

  userDb.all(`SELECT task_id FROM user_progress WHERE user_id = ?`, [userId], (err, rows) => {
    const completedTaskIds = rows ? rows.map(r => r.task_id) : [];
    const tasksWithProgress = TASKS.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      difficulty: t.difficulty,
      isFree: t.isFree,
      isCompleted: completedTaskIds.includes(t.id),
      hints: t.hints,
      tables: t.tables
    }));
    res.json(tasksWithProgress);
  });
});

app.get('/api/schema', (req, res) => {
  if (!learningDb) return res.json([]);
  try {
    const tablesRes = learningDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    if (!tablesRes.length) return res.json([]);

    const schema = tablesRes[0].values.map(row => {
      const tableName = row[0];
      const infoRes = learningDb.exec(`PRAGMA table_info(${tableName});`)[0].values.map(c => ({ name: c[1], type: c[2] }));
      
      let previewRes = { columns: [], values: [] };
      try {
        const queryResult = learningDb.exec(`SELECT * FROM ${tableName} LIMIT 3;`);
        if (queryResult.length > 0) previewRes = queryResult[0];
      } catch (e) {}

      return { table: tableName, columns: infoRes, preview: previewRes };
    });
    res.json(schema);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Заполните все поля" });

  const hashedPassword = await bcrypt.hash(password, 10);
  userDb.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashedPassword], function(err) {
    if (err) return res.status(400).json({ error: "Пользователь уже существует" });
    const token = jwt.sign({ id: this.lastID, email, isPaid: false }, JWT_SECRET);
    res.json({ success: true, token, email, isPaid: false });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  userDb.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: "Пользователь не найден" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: "Неверный пароль" });
    const isPaid = Boolean(user.is_paid);
    const token = jwt.sign({ id: user.id, email: user.email, isPaid }, JWT_SECRET);
    res.json({ success: true, token, email: user.email, isPaid });
  });
});

app.post('/api/check', (req, res) => {
  const { taskId, userQuery, token } = req.body || {};
  let isPaidUser = false;
  let userId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      isPaidUser = decoded.isPaid;
      userId = decoded.id;
    } catch (e) {}
  }

  const task = TASKS.find(t => t.id === taskId);
  if (!task) return res.json({ success: false, error: "Задача не найдена" });

  if (!task.isFree && !isPaidUser) {
    return res.json({ success: false, isLocked: true, message: "🔒 Эта задача доступна только по PRO-подписке!" });
  }

  const cleanUserQuery = userQuery ? userQuery.trim().replace(/;$/, '') : '';

  try {
    const expectedResult = learningDb.exec(task.correctQuery);
    const userResult = learningDb.exec(cleanUserQuery);

    if (!userResult || userResult.length === 0) {
      return res.json({ success: false, message: "Ваш запрос не вернул данных." });
    }

    const expectedJSON = JSON.stringify(expectedResult[0].values);
    const userJSON = JSON.stringify(userResult[0].values);

    if (expectedJSON === userJSON) {
      if (userId) {
        userDb.run(`INSERT OR IGNORE INTO user_progress (user_id, task_id) VALUES (?, ?)`, [userId, taskId]);
      }
      res.json({ success: true, isCorrect: true, message: "🎉 Абсолютно верно! Задача решена.", data: userResult });
    } else {
      res.json({ success: true, isCorrect: false, message: "❌ Неверно. Результат не совпадает с ожидаемым.", data: userResult });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/admin/make-pro', (req, res) => {
  const email = req.query.email;
  userDb.run(`UPDATE users SET is_paid = 1 WHERE email = ?`, [email], function() {
    res.send(`🎉 PRO-статус у ${email} активирован!`);
  });
});

app.listen(3001, () => {
  console.log('Сервер запущен на http://localhost:3001');
});