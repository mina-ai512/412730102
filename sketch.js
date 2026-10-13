// 設定 Google 試算表發布後的 CSV 題庫網址
const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3d4ylgaZBHKg0zEjHeQLCKTfXjxEFF1BqLYLunh09nxTtYdYn__PBRg-p4Gvs-vGBg24g8K8mEKxu/pub?output=csv";

// 設定每回合抽出的題目數量
const QUIZ_LENGTH = 5;

// 設定 CSV 必須具備的欄位名稱
const REQUIRED_COLUMNS = [
  "question",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "answer"
];

// 設定中文 Google Fonts 字體
const CHINESE_FONT = "Noto Serif HK";

// 設定英文與數字 Google Fonts 字體
const LATIN_FONT = "Bitcount Ink";

// 設定畫面顏色
const COLORS = {
  background: "#f5f7ff",
  darkText: "#222b55",
  mutedText: "#65709c",
  primary: "#4c6fff",
  success: "#16834c",
  error: "#b92548",
  correct: "#6a994e",
  correctLight: "#b8e8c5",
  wrongLight: "#ffd9df",
  white: "#ffffff"
};

// 儲存完整題庫
let questionBank = [];

// 儲存本回合隨機抽出的五題
let selectedQuestions = [];

// 儲存目前題目索引
let currentQuestion = 0;

// 儲存答對題數
let correctCount = 0;

// 儲存目前是否已經作答
let hasAnswered = false;

// 儲存使用者選擇的選項
let selectedOption = -1;

// 儲存選項點擊區域
let optionAreas = [];

// 儲存下一題按鈕區域
let nextButtonArea = null;

// 儲存重新開始按鈕區域
let restartButtonArea = null;

// 儲存題庫載入狀態
let loadingState = "loading";

// 儲存題庫錯誤訊息
let loadingError = "";

// 儲存原始資料列數
let rawRowCount = 0;

// 儲存有效題目數量
let validRowCount = 0;

// 儲存動畫開始時間
let animationStartTime = 0;

// 建立畫布
function setup() {
  // 建立符合瀏覽器視窗大小的畫布
  createCanvas(windowWidth, windowHeight);

  // 設定文字水平與垂直置中
  textAlign(CENTER, CENTER);

  // 設定矩形以中心點繪製
  rectMode(CENTER);

  // 設定畫布像素密度
  pixelDensity(1);

  // 關閉外框線
  noStroke();

  // 開始載入 Google 試算表題庫
  loadQuestionBank();
}

// 每一幀重新繪製畫面
function draw() {
  // 設定背景顏色
  background(COLORS.background);

  // 題庫載入中時顯示載入畫面
  if (loadingState === "loading") {
    drawLoadingScreen();
    return;
  }

  // 題庫載入錯誤時顯示錯誤畫面
  if (loadingState === "error") {
    drawErrorScreen();
    return;
  }

  // 五題完成後顯示結果畫面
  if (currentQuestion >= selectedQuestions.length) {
    drawResultScreen();
    return;
  }

  // 顯示答題畫面
  drawQuizScreen();
}

// 載入 Google 試算表題庫
function loadQuestionBank() {
  // 設定載入狀態
  loadingState = "loading";

  // 清除上一個錯誤訊息
  loadingError = "";

  // 使用 p5.js 的 loadTable 載入 CSV
  loadTable(
    GOOGLE_SHEET_CSV_URL,
    "csv",
    "header",

    // CSV 載入成功
    function(table) {
      // 取得原始資料列數
      rawRowCount =
        table && typeof table.getRowCount === "function"
          ? table.getRowCount()
          : 0;

      // 取得 CSV 欄位名稱
      const columns = getTableColumns(table);

      // 找出缺少的必要欄位
      const missingColumns = REQUIRED_COLUMNS.filter(function(column) {
        return columns.indexOf(column) === -1;
      });

      // 如果缺少必要欄位，顯示錯誤
      if (missingColumns.length > 0) {
        setQuestionBankError(
          "CSV 缺少必要欄位：" +
          missingColumns.join(", ")
        );
        return;
      }

      // 解析題庫資料
      questionBank = parseQuestionTable(table);

      // 儲存有效題目數量
      validRowCount = questionBank.length;

      // 如果沒有有效題目，顯示錯誤
      if (validRowCount === 0) {
        setQuestionBankError(
          "Google 試算表沒有有效題目，請檢查欄位與資料內容。"
        );
        return;
      }

      // 如果題目少於五題，顯示錯誤
      if (validRowCount < QUIZ_LENGTH) {
        setQuestionBankError(
          "有效題目少於五題，目前只有 " +
          validRowCount +
          " 題。"
        );
        return;
      }

      // 隨機抽出五題
      selectRandomQuestions();

      // 設定載入完成
      loadingState = "ready";
    },

    // CSV 載入失敗
    function() {
      // 顯示錯誤訊息
      setQuestionBankError(
        "無法讀取 Google 試算表，請確認試算表已發布到網路。"
      );
    }
  );
}

// 取得 Google 試算表欄位名稱
function getTableColumns(table) {
  // 如果沒有欄位資料，回傳空陣列
  if (!table || !Array.isArray(table.columns)) {
    return [];
  }

  // 清理欄位名稱前後空白
  return table.columns.map(function(column) {
    return String(column).trim();
  });
}

// 設定題庫錯誤狀態
function setQuestionBankError(message) {
  // 設定錯誤狀態
  loadingState = "error";

  // 儲存錯誤訊息
  loadingError = message;
}

// 解析 Google 試算表資料
function parseQuestionTable(table) {
  // 建立解析後的題目陣列
  const parsedQuestions = [];

  // 如果表格不存在，回傳空陣列
  if (!table || typeof table.getRowCount !== "function") {
    return parsedQuestions;
  }

  // 逐列讀取資料
  for (let rowIndex = 0; rowIndex < table.getRowCount(); rowIndex += 1) {
    // 取得目前資料列
    const row = table.getRow(rowIndex);

    // 讀取題目
    const question = readTableValue(row, "question");

    // 讀取四個選項
    const optionA = readTableValue(row, "optionA");
    const optionB = readTableValue(row, "optionB");
    const optionC = readTableValue(row, "optionC");
    const optionD = readTableValue(row, "optionD");

    // 讀取正確答案
    const answerValue = readTableValue(row, "answer").toUpperCase();

    // 略過不完整資料
    if (
      question === "" ||
      optionA === "" ||
      optionB === "" ||
      optionC === "" ||
      optionD === "" ||
      !["A", "B", "C", "D"].includes(answerValue)
    ) {
      continue;
    }

    // 將答案字母轉為索引
    const answerIndex =
      answerValue.charCodeAt(0) - 65;

    // 將題目加入題庫
    parsedQuestions.push({
      question: question,
      options: [
        optionA,
        optionB,
        optionC,
        optionD
      ],
      answer: answerIndex
    });
  }

  // 回傳解析完成的題庫
  return parsedQuestions;
}

// 安全讀取表格欄位
function readTableValue(row, columnName) {
  // 如果資料列不存在，回傳空字串
  if (!row || typeof row.get !== "function") {
    return "";
  }

  // 取得欄位內容
  const value = row.get(columnName);

  // 轉換成文字並移除前後空白
  return String(value == null ? "" : value).trim();
}

// 隨機抽出五題
function selectRandomQuestions() {
  // 複製題庫
  const shuffledQuestions = questionBank.slice();

  // 使用 Fisher-Yates 演算法洗牌
  for (
    let index = shuffledQuestions.length - 1;
    index > 0;
    index -= 1
  ) {
    // 取得隨機位置
    const randomIndex = floor(random(index + 1));

    // 暫存目前題目
    const temporary = shuffledQuestions[index];

    // 交換題目
    shuffledQuestions[index] =
      shuffledQuestions[randomIndex];

    // 完成交換
    shuffledQuestions[randomIndex] = temporary;
  }

  // 取出前五題
  selectedQuestions = shuffledQuestions.slice(
    0,
    QUIZ_LENGTH
  );

  // 重設測驗狀態
  currentQuestion = 0;
  correctCount = 0;
  hasAnswered = false;
  selectedOption = -1;
  optionAreas = [];
  nextButtonArea = null;
  restartButtonArea = null;
  animationStartTime = 0;
}

// 取得目前題目
function getCurrentQuestion() {
  // 回傳目前題目
  return selectedQuestions[currentQuestion];
}

// 顯示載入畫面
function drawLoadingScreen() {
  // 設定中文字體
  textFont(CHINESE_FONT);

  // 設定文字顏色
  fill(COLORS.darkText);

  // 設定標題大小
  textSize(min(width * 0.07, 32));

  // 顯示載入文字
  text(
    "正在載入題庫",
    width / 2,
    height / 2 - 25
  );

  // 設定提示文字大小
  textSize(min(width * 0.045, 18));

  // 顯示提示文字
  text(
    "請稍候，正在讀取 Google 試算表",
    width / 2,
    height / 2 + 25
  );
}

// 顯示題庫錯誤畫面
function drawErrorScreen() {
  // 設定中文字體
  textFont(CHINESE_FONT);

  // 設定錯誤標題顏色
  fill(COLORS.error);

  // 設定錯誤標題大小
  textSize(min(width * 0.07, 30));

  // 顯示錯誤標題
  text(
    "題庫載入失敗",
    width / 2,
    height / 2 - 100
  );

  // 設定錯誤訊息顏色
  fill(COLORS.darkText);

  // 設定錯誤訊息大小
  textSize(min(width * 0.045, 18));

  // 顯示錯誤訊息
  text(
    loadingError,
    width / 2,
    height / 2 - 40,
    width - 40,
    100
  );

  // 設定格式提示顏色
  fill(COLORS.mutedText);

  // 設定格式提示大小
  textSize(min(width * 0.035, 15));

  // 顯示 CSV 欄位格式
  text(
    "欄位：question, optionA, optionB, optionC, optionD, answer",
    width / 2,
    height / 2 + 45,
    width - 40,
    70
  );

  // 顯示資料格式
  text(
    "answer 請填 A、B、C 或 D，且至少需要五筆有效題目。",
    width / 2,
    height / 2 + 95,
    width - 40,
    70
  );
}

// 判斷字元是否為中文
function isChineseCharacter(character) {
  // 回傳中文判斷結果
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(character);
}

// 判斷字元是否為英文或數字
function isEnglishOrNumber(character) {
  // 回傳英文或數字判斷結果
  return /[A-Za-z0-9]/.test(character);
}

// 判斷字元應使用的字體
function getFontType(character) {
  // 中文使用 Noto Serif HK
  if (isChineseCharacter(character)) {
    return "chinese";
  }

  // 英文與數字使用 Bitcount Ink
  if (isEnglishOrNumber(character)) {
    return "latin";
  }

  // 半形符號使用 Bitcount Ink
  if (character.charCodeAt(0) <= 127) {
    return "latin";
  }

  // 其他字元使用中文字體
  return "chinese";
}

// 將混合文字切割為不同字體區段
function splitTextByFont(value) {
  // 將文字轉為字串
  const textValue = String(value);

  // 建立文字區段陣列
  const segments = [];

  // 儲存目前文字區段
  let currentText = "";

  // 儲存目前字體類型
  let currentType = "";

  // 逐字處理文字
  for (let index = 0; index < textValue.length; index += 1) {
    // 取得目前字元
    const character = textValue[index];

    // 取得字體類型
    const type = getFontType(character);

    // 字體類型改變時儲存前一段
    if (currentText !== "" && currentType !== type) {
      // 加入上一段文字
      segments.push({
        text: currentText,
        type: currentType
      });

      // 清除目前文字
      currentText = "";
    }

    // 加入目前字元
    currentText += character;

    // 更新字體類型
    currentType = type;
  }

  // 儲存最後一段文字
  if (currentText !== "") {
    // 加入最後一段
    segments.push({
      text: currentText,
      type: currentType
    });
  }

  // 回傳文字區段
  return segments;
}

// 套用字體
function applyFont(type) {
  // 英文與數字使用 Bitcount Ink
  if (type === "latin") {
    textFont(LATIN_FONT);
    return;
  }

  // 中文使用 Noto Serif HK
  textFont(CHINESE_FONT);
}

// 計算混合文字寬度
function getMixedTextWidth(value) {
  // 取得文字區段
  const segments = splitTextByFont(value);

  // 儲存文字總寬度
  let totalWidth = 0;

  // 逐段計算寬度
  for (let index = 0; index < segments.length; index += 1) {
    // 取得文字區段
    const segment = segments[index];

    // 套用字體
    applyFont(segment.type);

    // 加上文字寬度
    totalWidth += textWidth(segment.text);
  }

  // 回傳總寬度
  return totalWidth;
}

// 繪製混合字體文字
function drawMixedText(value, centerX, centerY) {
  // 取得文字區段
  const segments = splitTextByFont(value);

  // 計算文字總寬度
  const totalWidth = getMixedTextWidth(value);

  // 計算起始位置
  let currentX = centerX - totalWidth / 2;

  // 設定靠左對齊
  textAlign(LEFT, CENTER);

  // 逐段繪製文字
  for (let index = 0; index < segments.length; index += 1) {
    // 取得目前文字區段
    const segment = segments[index];

    // 套用字體
    applyFont(segment.type);

    // 繪製文字
    text(segment.text, currentX, centerY);

    // 移動到下一段位置
    currentX += textWidth(segment.text);
  }

  // 恢復文字置中
  textAlign(CENTER, CENTER);
}

// 取得響應式版面尺寸
function getLayout() {
  // 判斷是否為橫向畫面
  const isLandscape = width > height;

  // 判斷是否為小螢幕
  const isSmallScreen = min(width, height) <= 600;

  // 計算縮放比例
  const scale = constrain(
    min(width / 900, height / 850),
    0.56,
    1.12
  );

  // 設定內容寬度
  const contentWidth = min(
    max(width - (isSmallScreen ? 32 : 72), 220),
    960
  );

  // 回傳版面資料
  return {
    isLandscape: isLandscape,
    contentWidth: contentWidth,
    topPadding: isSmallScreen ? 24 : 38,
    titleSize: constrain(31 * scale, 20, 36),
    progressSize: constrain(17 * scale, 13, 20),
    questionSize: constrain(22 * scale, 15, 27),
    optionSize: constrain(19 * scale, 14, 23),
    questionHeight: isLandscape
      ? constrain(height * 0.18, 72, 112)
      : constrain(height * 0.15, 104, 160),
    optionHeight: isLandscape
      ? constrain(height * 0.13, 44, 58)
      : constrain(height * 0.075, 48, 66),
    optionGap: isLandscape
      ? constrain(height * 0.145, 52, 70)
      : constrain(height * 0.088, 60, 80)
  };
}

// 繪製載入中的畫面
function drawLoadingScreen() {
  // 設定中文字體
  textFont(CHINESE_FONT);

  // 設定文字顏色
  fill(COLORS.darkText);

  // 設定文字大小
  textSize(min(width * 0.07, 32));

  // 顯示載入文字
  text(
    "正在載入題庫",
    width / 2,
    height / 2 - 25
  );

  // 設定提示文字大小
  textSize(min(width * 0.045, 18));

  // 顯示提示
  text(
    "請稍候，正在讀取 Google 試算表",
    width / 2,
    height / 2 + 25
  );
}

// 繪製答題畫面
function drawQuizScreen() {
  // 取得目前題目
  const quiz = getCurrentQuestion();

  // 取得響應式版面
  const layout = getLayout();

  // 計算畫面中央
  const centerX = width / 2;

  // 設定標題文字顏色
  fill(COLORS.darkText);

  // 設定標題文字大小
  textSize(layout.titleSize);

  // 顯示標題
  drawMixedText(
    "p5.js 指令小測驗",
    centerX,
    layout.topPadding
  );

  // 設定題數文字顏色
  fill(COLORS.mutedText);

  // 設定題數文字大小
  textSize(layout.progressSize);

  // 顯示題數
  drawMixedText(
    "第 " +
    (currentQuestion + 1) +
    " 題／共 " +
    selectedQuestions.length +
    " 題",
    centerX,
    layout.topPadding + layout.titleSize + 18
  );

  // 計算題目卡片位置
  const questionY =
    layout.topPadding +
    layout.titleSize +
    18 +
    layout.questionHeight * 0.65;

  // 繪製題目卡片陰影
  fill(0, 0, 0, 18);
  rect(
    centerX + 4,
    questionY + 5,
    layout.contentWidth,
    layout.questionHeight,
    18
  );

  // 繪製題目卡片
  fill(COLORS.white);
  rect(
    centerX,
    questionY,
    layout.contentWidth,
    layout.questionHeight,
    18
  );

  // 設定題目文字顏色
  fill(COLORS.darkText);

  // 設定題目文字大小
  textSize(layout.questionSize);

  // 顯示題目
  drawMixedText(
    quiz.question,
    centerX,
    questionY
  );

  // 設定選項欄數
  const columns = layout.isLandscape ? 2 : 1;

  // 計算選項寬度
  const optionWidth = columns === 2
    ? (layout.contentWidth - 14) / 2
    : layout.contentWidth;

  // 計算選項起始位置
  const optionStartY =
    questionY +
    layout.questionHeight / 2 +
    layout.optionGap * 0.72;

  // 清除選項位置
  optionAreas = [];

  // 逐一繪製四個選項
  for (let index = 0; index < quiz.options.length; index += 1) {
    // 計算選項列
    const row = columns === 2 ? floor(index / 2) : index;

    // 計算選項欄
    const column = columns === 2 ? index % 2 : 0;

    // 計算選項水平位置
    const optionX = columns === 2
      ? centerX -
        optionWidth / 2 -
        7 +
        column * (optionWidth + 14)
      : centerX;

    // 計算選項垂直位置
    let optionY =
      optionStartY +
      row * layout.optionGap;

    // 判斷是否為答錯後的正確選項
    const isCorrectHighlighted =
      hasAnswered &&
      selectedOption !== quiz.answer &&
      index === quiz.answer;

    // 判斷是否為錯誤選項
    const isWrongSelected =
      hasAnswered &&
      selectedOption === index &&
      selectedOption !== quiz.answer;

    // 判斷是否為答對選項
    const isCorrectSelected =
      hasAnswered &&
      selectedOption === quiz.answer &&
      index === quiz.answer;

    // 讓正確選項上下跳動
    if (isCorrectHighlighted) {
      // 計算動畫位移
      optionY +=
        sin((millis() - animationStartTime) * 0.012) * 9;
    }

    // 儲存選項區域
    optionAreas.push({
      x: optionX,
      y: optionY,
      width: optionWidth,
      height: layout.optionHeight
    });

    // 預設選項使用白色
    let optionColor = COLORS.white;

    // 答錯時正確選項使用指定綠色
    if (isCorrectHighlighted) {
      optionColor = COLORS.correct;
    }

    // 錯誤選項使用淡紅色
    if (isWrongSelected) {
      optionColor = COLORS.wrongLight;
    }

    // 答對選項使用淡綠色
    if (isCorrectSelected) {
      optionColor = COLORS.correctLight;
    }

    // 繪製選項陰影
    fill(0, 0, 0, 16);
    rect(
      optionX + 3,
      optionY + 4,
      optionWidth,
      layout.optionHeight,
      14
    );

    // 繪製選項背景
    fill(optionColor);
    rect(
      optionX,
      optionY,
      optionWidth,
      layout.optionHeight,
      14
    );

    // 設定選項文字顏色
    fill(
      isCorrectHighlighted
        ? COLORS.white
        : COLORS.darkText
    );

    // 設定選項文字大小
    textSize(layout.optionSize);

    // 顯示選項文字
    drawMixedText(
      String.fromCharCode(65 + index) +
      ". " +
      quiz.options[index],
      optionX,
      optionY
    );
  }

  // 判斷是否已作答
  if (hasAnswered) {
    // 計算最後一列
    const lastRow = columns === 2 ? 1 : 3;

    // 計算答題訊息位置
    const messageY =
      optionStartY +
      (lastRow + 1.02) * layout.optionGap;

    // 計算下一題按鈕位置
    const buttonY =
      messageY +
      layout.optionGap * 0.62;

    // 顯示答題訊息
    drawAnswerMessage(
      centerX,
      messageY,
      layout
    );

    // 顯示下一題按鈕
    drawNextButton(
      centerX,
      buttonY,
      layout
    );
  }
}

// 繪製答題訊息
function drawAnswerMessage(centerX, y, layout) {
  // 判斷答案是否正確
  const isCorrect =
    selectedOption ===
    getCurrentQuestion().answer;

  // 設定文字顏色
  fill(
    isCorrect
      ? COLORS.success
      : COLORS.error
  );

  // 設定文字大小
  textSize(layout.progressSize);

  // 顯示答題訊息
  drawMixedText(
    isCorrect
      ? "答對了！"
      : "答錯了，正確選項已標示。",
    centerX,
    y
  );
}

// 繪製下一題按鈕
function drawNextButton(centerX, y, layout) {
  // 設定按鈕寬度
  const buttonWidth =
    min(layout.contentWidth, 340);

  // 設定按鈕高度
  const buttonHeight =
    constrain(layout.optionHeight, 48, 64);

  // 儲存按鈕區域
  nextButtonArea = {
    x: centerX,
    y: y,
    width: buttonWidth,
    height: buttonHeight
  };

  // 繪製按鈕陰影
  fill(0, 0, 0, 18);
  rect(
    centerX + 3,
    y + 4,
    buttonWidth,
    buttonHeight,
    14
  );

  // 繪製按鈕
  fill(COLORS.primary);
  rect(
    centerX,
    y,
    buttonWidth,
    buttonHeight,
    14
  );

  // 設定文字顏色
  fill(COLORS.white);

  // 設定文字大小
  textSize(layout.progressSize + 2);

  // 顯示按鈕文字
  drawMixedText(
    currentQuestion === selectedQuestions.length - 1
      ? "查看結果"
      : "下一題",
    centerX,
    y
  );
}

// 繪製結果畫面
function drawResultScreen() {
  // 取得響應式版面
  const layout = getLayout();

  // 計算畫面中央
  const centerX = width / 2;
  const cardY = height / 2;

  // 設定結果卡片大小
  const cardWidth = min(width - 28, 620);
  const cardHeight = min(
    max(height - 42, 280),
    430
  );

  // 繪製卡片陰影
  fill(0, 0, 0, 18);
  rect(
    centerX + 5,
    cardY + 6,
    cardWidth,
    cardHeight,
    20
  );

  // 繪製卡片
  fill(COLORS.white);
  rect(
    centerX,
    cardY,
    cardWidth,
    cardHeight,
    20
  );

  // 設定標題文字
  fill(COLORS.darkText);
  textSize(layout.titleSize);

  // 顯示完成文字
  drawMixedText(
    "測驗完成！",
    centerX,
    cardY - cardHeight * 0.25
  );

  // 設定分數文字
  fill(COLORS.primary);
  textSize(
    constrain(layout.titleSize * 1.4, 34, 52)
  );

  // 顯示分數
  drawMixedText(
    correctCount +
    " / " +
    selectedQuestions.length,
    centerX,
    cardY - cardHeight * 0.04
  );

  // 設定說明文字
  fill(COLORS.mutedText);
  textSize(layout.progressSize + 2);

  // 顯示答對題數
  drawMixedText(
    "你答對了 " +
    correctCount +
    " 題",
    centerX,
    cardY + cardHeight * 0.13
  );

  // 設定重新開始按鈕位置
  const restartY =
    cardY +
    cardHeight * 0.29;

  // 設定按鈕寬度與高度
  const restartWidth =
    min(cardWidth - 42, 320);
  const restartHeight =
    constrain(layout.optionHeight, 48, 64);

  // 儲存重新開始按鈕
  restartButtonArea = {
    x: centerX,
    y: restartY,
    width: restartWidth,
    height: restartHeight
  };

  // 繪製重新開始按鈕
  fill(COLORS.primary);
  rect(
    centerX,
    restartY,
    restartWidth,
    restartHeight,
    14
  );

  // 設定按鈕文字
  fill(COLORS.white);
  textSize(layout.progressSize + 2);

  // 顯示重新開始文字
  drawMixedText(
    "重新開始",
    centerX,
    restartY
  );
}

// 處理滑鼠與觸控事件
function mousePressed() {
  // 題庫載入中或錯誤時不執行答題
  if (loadingState !== "ready") {
    return false;
  }

  // 判斷是否完成全部題目
  if (currentQuestion >= selectedQuestions.length) {
    // 判斷是否點擊重新開始
    if (
      isInsideArea(
        mouseX,
        mouseY,
        restartButtonArea
      )
    ) {
      // 重新抽五題
      selectRandomQuestions();
    }

    // 結束事件
    return false;
  }

  // 尚未作答時檢查選項
  if (!hasAnswered) {
    // 逐一檢查四個選項
    for (let index = 0; index < optionAreas.length; index += 1) {
      // 判斷是否點擊目前選項
      if (
        isInsideArea(
          mouseX,
          mouseY,
          optionAreas[index]
        )
      ) {
        // 記錄使用者選項
        selectedOption = index;

        // 設定為已作答
        hasAnswered = true;

        // 判斷是否答對
        if (
          selectedOption ===
          getCurrentQuestion().answer
        ) {
          // 增加答對題數
          correctCount += 1;
        }

        // 記錄動畫開始時間
        animationStartTime = millis();

        // 離開迴圈
        break;
      }
    }
  } else if (
    isInsideArea(
      mouseX,
      mouseY,
      nextButtonArea
    )
  ) {
    // 進入下一題
    currentQuestion += 1;

    // 重設作答狀態
    hasAnswered = false;

    // 清除選項
    selectedOption = -1;

    // 清除下一題按鈕
    nextButtonArea = null;
  }

  // 防止觸控裝置執行額外操作
  return false;
}

// 判斷座標是否位於指定區域
function isInsideArea(x, y, area) {
  // 判斷區域是否存在
  if (!area) {
    // 區域不存在時回傳 false
    return false;
  }

  // 判斷座標是否位於矩形區域
  return (
    x >= area.x - area.width / 2 &&
    x <= area.x + area.width / 2 &&
    y >= area.y - area.height / 2 &&
    y <= area.y + area.height / 2
  );
}

// 重新開始測驗
function restartQuiz() {
  // 從完整題庫重新隨機抽出五題
  selectRandomQuestions();
}

// 視窗大小改變時重新調整畫布
function windowResized() {
  // 重新設定畫布寬高
  resizeCanvas(windowWidth, windowHeight);
}