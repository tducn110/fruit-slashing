# Review responsive hiện tại — 01_fruit

Ngày review: 2026-09-07. Checkout: `/home/pro/Downloads/intern/onprogress/01_fruit`.
HEAD: `35ddbd40461c67676b5f654ef021d433a048a488`.

## Phạm vi và kết luận

Review cách responsive đang hoạt động dựa trên source hiện tại, kiểm tra layout trong Chrome local và chạy các kiểm tra hiện có. Không sửa code game, CSS, dependency hay test; chỉ thêm báo cáo này ở root. Đây là review responsive đầy đủ, không giới hạn ở việc tìm code dư thừa của lượt ponytail trước.

**Chưa đạt responsive cho màn ngang/màn thấp.** Hai lỗi tái hiện rõ nhất là CTA vào game nằm ngoài viewport của landing và pause menu bị cắt. Portrait phổ biến có thể vào game và canvas theo đúng vùng còn lại dưới top bar, nhưng có sự không đồng nhất giữa phép chiếu world, kích thước sprite, hitbox và cấu hình giữ nguyên sau resize.

Quy ước bằng chứng:

- **Runtime:** đo DOM/canvas trên local Chrome hoặc quan sát screenshot.
- **Source + probe:** đọc đường thực thi và gọi hàm hiện có bằng dữ liệu kiểm tra riêng; không thay đổi state của ván đang chơi.
- **Source / cần xác minh thiết bị:** có cơ sở trong source, chưa tuyên bố tái hiện trên điện thoại thật.
- P1: chặn/cắt luồng chính ở một viewport phổ biến; P2: sai lệch responsive hoặc trải nghiệm đáng xử lý; P3: hoàn thiện, thống nhất chính sách hoặc bổ sung kiểm tra.

## 1. Responsive hiện hoạt động dựa trên những gì?

### 1.1. DOM quyết định vùng chứa; Pixi đo vùng đó

`GamePage.tsx:124` tạo `.game-container` fixed, `inset: 0`, `width: 100vw`, `height: 100dvh`, flex dọc. `.gameTopBar` nằm trong flow và không co lại; wrapper phía dưới `flex: 1`, `position: relative`, `overflow: hidden` (`GamePage.tsx:174`).

`.game-canvas-layer` và `.game-panel-layer` đều absolute phủ wrapper phía dưới, không phủ toàn viewport. `FruitGame` có wrapper 100% × 100%; Pixi canvas, React HUD, floating text, countdown, game over và pause cùng nằm dưới top bar.

`usePixiApp.ts:31` lấy `wrap.clientWidth/clientHeight`, clamp tối thiểu 320 × 200, rồi tạo renderer. Canvas CSS rộng/cao 100%; `autoDensity` xử lý backing buffer theo resolution.

Resize có một owner chính tại `usePixiApp.ts:50`:

1. `ResizeObserver(wrap)`, `visualViewport.resize`, `orientationchange` gọi scheduler.
2. Scheduler gom thông báo về một requestAnimationFrame.
3. Nếu kích thước thực đổi: cập nhật `sizeRef`, resize renderer, dựng lại background Graphics.
4. Callback trong `FruitGame.tsx:69` đồng bộ lại sprite của fruit đang tồn tại.

Điểm tốt: không tạo Application mới mỗi resize; background không gọi `generateTexture()` mỗi resize. Texture fruit được tạo trong `useFruitTextures` theo lifecycle app và tái sử dụng. Việc dựng lại Graphics nền vẫn tồn tại; review này không đo chi phí GPU.

### 1.2. World cố định, có hai chế độ chiếu

`core.ts:3` giữ world 1000 × 600; physics/collision dùng tọa độ world. `getWorldRenderTransform()` tại `core.ts:265` chọn:

- Khi **canvas width ≤ 640 và canvas height / width ≥ 1.35**: `scaleX = width/1000`, `scaleY = height/600`. Tọa độ phủ hết vùng canvas nhưng hai trục có scale khác nhau.
- Các trường hợp khác: dùng `min(width/1000, height/600)` cho cả hai trục, căn giữa world; có vùng đệm trên/dưới hoặc hai bên.

Đây là tỉ lệ của **canvas sau khi trừ top bar**, không phải tỉ lệ toàn màn hình. Tablet dọc 768 px không đi vào nhánh portrait này.

| Viewport CSS px | Canvas đo được | scaleX | scaleY | Cách chiếu |
| --- | --- | --- | --- | --- |
| 320 × 568 | 320 × 513 | 0.320 | 0.855 | Kéo hai trục |
| 390 × 844 | 390 × 789 | 0.390 | 1.315 | Kéo hai trục |
| 640 × 360 | 640 × 305 | 0.5083 | 0.5083 | Fit, đệm hai bên |
| 844 × 390 | 844 × 331 | 0.5517 | 0.5517 | Fit, đệm hai bên |
| 768 × 1024 | 768 × 965 | 0.768 | 0.768 | Fit, đệm trên/dưới |
| 1440 × 900 | 1440 × 841 | 1.4017 | 1.4017 | Fit, đệm hai bên |

Các giá trị transform được kiểm tra bằng chính hàm import từ source. Với tablet 768 × 1024, world cao 460.8 px trong canvas cao 965 px, để lại khoảng 252.1 px mỗi phía theo trục Y. Nền vẫn phủ cả canvas nên vùng world không được phân định trực quan như letterbox đen.

### 1.3. Sprite, input và cấu hình không dùng chung một chính sách resize

| Thành phần | Nguồn kích thước / scale | Thời điểm cập nhật |
| --- | --- | --- |
| Vị trí fruit | World transform từ `sizeRef` | Mỗi lần sync, có callback resize |
| Kích thước fruit | `scaleX × (VISUAL_RADIUS/20) × 0.9 × fruitScale` | Mỗi lần sync |
| `fruitScale` | ≤430: 2; ≤640: 1.45; còn lại: 1 | Theo chiều rộng canvas hiện tại |
| Hitbox/spawn | `getGameConfig(width)` | Khi `handleStart` tạo world |
| Pointer | DOM rect → tọa độ renderer → inverse world transform → normalize | Mỗi pointer sample, DOM rect được cache |
| Resolution/antialias | DPR và `getFxPreset(initialWidth)` | Khi khởi tạo Application |
| Số slot particle | FX preset lúc `initPool` | Khi app/texture sẵn sàng |
| Lượng FX mới, giới hạn trail | FX preset theo width hiện tại | Khi sử dụng |
| Fruit halves / particle / floating text | Tọa độ screen lưu tại lúc spawn | Chạy tiếp theo tọa độ cũ; callback resize không reproject |

Input có bước đổi từ CSS rect sang renderer size tại `useGamePointerInput.ts:83`, nên không đơn giản lấy clientX/clientY làm world. Callback ref giữ listener ổn định qua React render là nền tảng tốt cần giữ.

## 2. Các phát hiện

### R01 — P1 — Landing cắt CTA trên màn ngang/màn thấp

**Bằng chứng: Runtime, kiểm tra EN và VI tại 844 × 390.**

- 844 × 390: hero cao 618.08 px; nút Play Now / Chơi ngay bắt đầu tại Y=494.58, kết thúc Y=558.08. Toàn bộ nút nằm dưới viewport.
- 640 × 360, EN: nút Play bắt đầu Y=443.69; nút Leaderboard kết thúc Y=563.69.
- `html/body/#root` bị khóa `overflow: hidden` ở `index.html:14` và `game-ui.css:971`; landing không có scroller riêng để người dùng kéo xuống CTA.

**Nguyên nhân:** `HeroSection.tsx:20` dùng min-height viewport nhưng nội dung vẫn có chiều cao tối thiểu từ padding, title, stats và CTA. CSS compact chỉ có điều kiện width ≤640; kể cả nhánh max-height 760 vẫn giữ padding-top lớn. Màn ngang rộng 844 px đi theo layout desktop với padding 80 + 60 px và gap 28 px.

**Hướng xử lý đề xuất:** quy định layout cho chiều cao khả dụng thấp; cho landing cuộn trong vùng sở hữu của nó hoặc bố trí compact bảo đảm CTA hiện diện. Không coi tăng/đổi min-height là đủ nếu ancestor vẫn cắt nội dung.

**Acceptance:** vào được game bằng thao tác chạm nhìn thấy được ở 568 × 320, 640 × 360, 844 × 390; cả EN/VI; không cần xoay máy lại hay dùng automation scroll/click vào phần ngoài viewport.

### R02 — P1/P2 — Pause menu không fit theo chiều cao; minimum width làm tràn màn 320 px

**Bằng chứng: Runtime + screenshot ở 844 × 390.**

| Viewport | Pause card | Resume button | Kết quả |
| --- | --- | --- | --- |
| 390 × 844 | x=19.5, y=271.5, 351 × 356 | y=489.5..593.5 | Nằm trong viewport |
| 320 × 568 | x=16, width=320, right=336 | Nằm trong viewport theo Y | Card bị cắt phải 16 px |
| 844 × 390 | y=75, height=408, bottom=483 | y=325..449 | Card và phần dưới Resume bị cắt |
| 640 × 360 | y=71, height=408, bottom=479 | y=321..445 | Resume chỉ lộ phần trên |

**Nguồn:** `game-ui.css:1297` (`.pauseHudOverlay`), `:1308` (`.pauseHudCard`), `:1331`, `:1370`; `PauseOverlay.tsx` chứa bốn utility button trong hai hàng và một Resume button.

Card dùng `width: clamp(320px, 90vw, 400px)`, trong khi overlay có padding 16 px hai phía. Với viewport 320 px, vùng content chỉ rộng 288 px. Theo chiều cao, nội dung/gap/padding đẩy card lên 356–408 px dù có `aspect-ratio: 1.25`; không có max-height/overflow hay layout landscape để cứu phần dư. Wrapper ngoài cắt overflow.

**Hướng xử lý đề xuất:** giới hạn card theo content box của overlay; thêm bố cục theo chiều cao thực còn lại dưới top bar hoặc cho overlay cuộn. Giữ đủ kích thước thao tác cho các nút.

**Acceptance:** cả card và toàn bộ Resume nằm trong viewport hoặc có đường cuộn chạm thực sự tới được; test 320 px và landscape 320–390 px cao.

### R03 — P2 — Hitbox portrait kéo dài theo Y trong khi sprite scale đều

**Bằng chứng: Source + probe core riêng; kích thước texture/sprite lấy từ runtime.**

`useFruitSprites.ts:83–120` đặt vị trí bằng scaleX/scaleY, nhưng `sprite.scale.set(...)` dùng cùng một giá trị theo scaleX cho cả hai trục. `core.ts:335` kiểm tra hình tròn trong world; chiếu ra screen ở portrait thành ellipse.

Ví dụ lychee tại canvas 390 × 789, ván bắt đầu ở width 390:

- Radius core=26; `getGameConfig(390).hitboxScale=2` → radius collision world=52.
- Hitbox screen có bán trục X=20.28 px, Y=68.38 px.
- Texture lychee runtime 46 × 46; sprite scale=0.7722 → hình hiển thị khoảng 35.52 × 35.52 px, nửa chiều cao khoảng 17.76 px.
- Probe đặt một lychee tại world (500,300), lấy điểm screen cách tâm 50 px xuống dưới, đổi về world rồi gọi `applyInput`: **trúng**. Đây là điểm ngoài bounding box sprite nhưng trong ellipse hitbox.

Hitbox rộng hơn hình có thể là hỗ trợ mobile có chủ đích. Điểm cần review là mức hỗ trợ theo Y lớn khoảng 3.85 lần nửa chiều cao sprite, khác hẳn theo X; cùng cơ chế cũng áp dụng với bomb. Không nên kết luận mọi vùng đệm hitbox đều là bug hoặc tự thu hitbox trước khi thống nhất gameplay.

**Hướng xử lý đề xuất:** xác định chính sách hitbox theo screen và mức hỗ trợ mong muốn; thống nhất với sprite và projection. Kiểm tra chém sát trên/dưới/trái/phải fruit và bomb, không chỉ chém xuyên tâm.

### R04 — P2 — Đổi breakpoint làm vị trí/kích thước nhảy; config gameplay vẫn giữ từ đầu ván

**Bằng chứng: Source + gọi trực tiếp `getWorldRenderTransform`.**

- Canvas 390 × 527: scaleY=0.87833. Chỉ giảm chiều cao xuống 526: scaleY=0.39. Phạm vi world theo Y đổi từ 527 px sang 234 px vì vượt ngưỡng ratio 1.35.
- Canvas 640 × 900: scaleY=1.5, fruitScale=1.45. Sang 641 × 900: scaleY=0.641, fruitScale=1.
- 430 → 431 px, với chiều cao không đổi và vẫn portrait: fruitScale từ 2 xuống 1.45; scale hiển thị giảm khoảng 27.3% chỉ qua 1 px chiều rộng.

`FruitGame.tsx:384` chỉ gọi `getGameConfig(sizeRef.current.w)` lúc `handleStart`. Callback resize tại `:69` chỉ sync sprite, không cập nhật `state.config`. Vì vậy xoay từ portrait 390 sang landscape 844 vẫn giữ hitboxScale=2 và spawnYOffset=-100 của mobile, trong khi sprite đã dùng fruitScale=1. Ván bắt đầu trực tiếp ở 844 có hitboxScale=1.3 và spawnYOffset=40. Cùng viewport cuối có hành vi khác nhau tùy cách đi tới đó.

**Hướng xử lý đề xuất:** quyết định rõ giữ world/config ổn định cả ván hay hỗ trợ đổi mode giữa ván. Nếu giữ để đảm bảo replay/physics, presentation và hitbox phải được thiết kế nhất quán với lựa chọn đó; không tự động đổi physics giữa ván chỉ để đồng bộ CSS. Làm mượt hoặc tránh các ngưỡng đổi phép chiếu đột ngột.

**Acceptance:** resize qua 430/431, 640/641, ratio 1.35 và portrait ↔ landscape; so sánh ván khởi tạo mới với ván xoay máy ở cùng viewport cuối.

### R05 — P2 — Fruit halves không kế thừa scale của quả nguyên

**Bằng chứng: Source.**

Texture nguyên và halves đều được tạo từ cùng `VISUAL_RADIUS[kind]` trong `useFruitTextures.ts:44–64`. Quả nguyên nhận thêm `(VISUAL_RADIUS/20) × 0.9 × fruitScale` (`useFruitSprites.ts:120`), nhưng halves chỉ nhận `scaleX` (`useSliceEffects.ts:292`).

Với lychee trên width 390, scale quả nguyên=0.7722, scale half=0.39. Tỉ lệ scale half/nguyên chỉ khoảng 50.5%, ngoài khác biệt hình học vốn có giữa hình nguyên và hình nửa. Đây là chênh lệch scale của artwork, không phải kết luận rằng mỗi nửa phải có cùng chiều rộng với cả quả.

**Hướng xử lý đề xuất:** dùng cùng hệ số scale artwork cho quả và nửa quả trước khi áp dụng chuyển động tách. Xác minh visually các loại quả tại 390, 430, 431, 768 và landscape.

### R06 — P2 — Resize chưa đồng bộ trail, effect và cache rect theo cùng một nhịp

**Bằng chứng: Source; chưa tái hiện một lần chém sai trên thiết bị thật.**

- Callback resize chỉ reproject live fruit (`FruitGame.tsx:69`). Trail lưu screen x/y; halves, particles, floating text cũng lưu screen x/y tại lúc spawn.
- `useGamePointerInput.ts:112` chuyển các điểm trail cũ về world bằng transform hiện tại. Resize giữa một gesture có thể làm điểm trước resize được hiểu theo hệ tọa độ mới, tạo segment không đúng đường tay đã đi.
- DOM rect cache cập nhật lúc mount, pointerdown, `window.resize`, `window.scroll` (`useGamePointerInput.ts:61`, `:168`). Resize owner còn nhận ResizeObserver và visualViewport; thay đổi kích thước wrapper mà không có window.resize không trực tiếp invalidates rect cache trong gesture đang giữ.
- Pointerdown tiếp theo có `updateRect()`, nên không kết luận input luôn sai sau mọi resize. Tình huống cần kiểm tra là đang giữ pointer trong khi host/viewport thay đổi.

**Hướng xử lý đề xuất:** resize là một transaction rõ ràng cho renderer và input: invalidate rect và kết thúc/xóa hoặc reproject trail; chọn chính sách cho effect tồn tại ngắn. Không bỏ callback ref ổn định hiện có.

**Acceptance:** giữ ngón tay kéo qua một thay đổi chiều cao host; kiểm tra trail không nối nhảy, không chém ngoài đường tay; thử khi thanh browser co/giãn và iframe đổi size.

### R07 — P3 — FX responsive pha trộn giá trị lúc mount và giá trị hiện tại

**Bằng chứng: Runtime DPR=3 + source.**

Khởi tạo ở mobile emulation 390 × 844, DPR=3: renderer resolution=1, pool có 80 particle slot. Đổi cùng app sang 844 × 390: renderer resize đúng 844 × 331 nhưng resolution vẫn 1, pool vẫn 80 slot.

`getFxPreset(844)` lại chọn desktop preset resolutionCap=1.5, maxParticles=160 và lượng particle mỗi hit cao hơn. `usePixiApp.ts:36` chỉ đọc preset/DPR lúc init; `FruitGame.tsx:259` chỉ init pool khi app/texture ready. Những effect mới và trail đọc width hiện tại.

Giữ resolution/antialias cố định có thể là lựa chọn hợp lý để ổn định renderer. Điều chưa rõ là đây có phải chính sách đã chủ động chọn hay không: cùng viewport cuối nhận chất lượng và dung lượng pool khác nhau tùy orientation lúc vào game.

**Hướng xử lý đề xuất:** thống nhất phân loại thiết bị cố định hay cấu hình theo viewport; ghi rõ mục nào cố định trong ván và mục nào có thể đổi. Không đề xuất rebuild WebGL context trên mọi resize.

### R08 — P3 — HUD/panel mobile cộng offset của top bar lần nữa

**Bằng chứng: Runtime + source.**

Top bar thực đo ở mobile cao 55 px. `.gameHud` là con vùng game đã bắt đầu ở Y=55, nhưng CSS mobile tiếp tục đặt `top: 48px + safe-area-top` (`game-ui.css:49`). Vì vậy HUD bắt đầu ở Y=103. Desktop có top bar 59 px và HUD local top=14 → Y=73.

`settingsPanel` tương tự: nằm trong vùng dưới top bar nhưng mobile top=58 px + safe area → vị trí global Y=113 khi safe area bằng 0. Với dashboard ở 390 × 844, panel đo được y=113..834 và cao 721 px dù dữ liệu local rỗng, do cả top và bottom được đặt.

Đây là khoảng trống/nhảy bố cục đã xác nhận, chưa coi là lỗi che nội dung độc lập khi chưa có visual contract yêu cầu HUD nằm sát top. Tuy nhiên safe-area-top đang được áp dụng ở cả top bar và các con dưới nó.

**Hướng xử lý đề xuất:** xác định mọi offset là theo viewport hay theo game container. HUD nên dùng inset local; safe area nên được owner phù hợp áp dụng một lần.

### R09 — P3 — Safe area, giới hạn renderer và text chưa có contract đồng nhất

**Bằng chứng: Source / cần kiểm tra thiết bị.**

- `index.html` bật `viewport-fit=cover`; top bar có xử lý inset-top nhưng padding ngang không lấy inset-left/right. Pause và game-over không có padding safe-area-bottom. Chưa kiểm tra iPhone notch/home indicator; không ghi nhận đây là lỗi tái hiện trên iPhone.
- Renderer clamp tối thiểu 320 × 200 nhưng canvas CSS vẫn 100% vùng chứa. Nếu iframe <320 px rộng hoặc vùng game <200 px cao, hình bị CSS scale thêm. Input có quy đổi renderer/rect, nhưng floating text DOM dùng renderer screen x/y trực tiếp; tọa độ DOM không còn chắc chắn trùng sprite. Đây là trường hợp ngoài ma trận runtime đã kiểm tra.
- `FloatingTextLayer.tsx:30–33` clamp top theo `100dvh - 48px` dù layer chỉ cao viewport trừ top bar. Giới hạn này có thể nằm dưới đáy game container; không phải clamp theo vùng thực sở hữu text.

**Hướng xử lý đề xuất:** công bố viewport tối thiểu hoặc đảm bảo geometry DOM/canvas dùng cùng content box; phân định safe area thuộc UI hay toàn playfield. Test notch hai hướng landscape và các embed thấp/hẹp.

## 3. Những phần đã có và không nên kết luận sai

- ResizeObserver và RAF coalescing đã tồn tại; không cần thêm một resize owner thứ hai vào FruitGame.
- Canvas theo đúng wrapper dưới top bar ở các viewport đã đo; không phải mọi lỗi responsive đều do canvas không resize.
- Pointer có inverse transform và CSS-to-renderer conversion. Lỗi cần kiểm tra là consistency qua thay đổi geometry, không phải thiếu hoàn toàn bước đổi tọa độ.
- Tablet dọc dùng world fit với vùng đệm là hành vi từ source. Việc có muốn phủ đầy màn hay không cần quyết định sản phẩm; chưa gọi riêng việc có vùng đệm là bug.
- Leaderboard dạng màn riêng, dữ liệu local rỗng, giữ được nút Back trong viewport ở 320 × 568, 640 × 360, 844 × 390. Dashboard trong game cũng nằm trong viewport ở ba kích thước đã đo.
- Chưa kiểm tra leaderboard có đủ 10 dòng, tên dài hoặc player ngoài top 10; không suy rộng kết quả dữ liệu rỗng thành pass cho dữ liệu thật.
- Các rule mobile cho `.dashboardRankRow`, badge/name/score nằm trước rule base cùng specificity trong `game-ui.css:402–480`; một số thuộc tính compact bị rule sau ghi đè. Đây là điểm cascade cần kiểm tra khi có dữ liệu thật, chưa là lỗi runtime độc lập trong lần review này.

## 4. Kiểm tra đã làm và giới hạn bằng chứng

### Đã làm

- Đọc source ownership: App → GamePage → FruitGame → Pixi app/render/input/core; landing, pause, game over, settings, dashboard, floating text và CSS.
- Chạy local bằng `npm run dev -- --host 0.0.0.0 --port 5173` trong context trình duyệt review riêng.
- Đo DOM rect, overflow, canvas và Pixi screen tại 320 × 568, 390 × 844, 640 × 360, 844 × 390, 768 × 1024, 1440 × 900 theo từng màn nêu trong báo cáo.
- Kiểm tra EN/VI cho landing 844 × 390 và 320 × 568; pause/menu chính được đo ở EN. Không tuyên bố đã chạy toàn bộ tích Descartes viewport × màn × ngôn ngữ.
- Quan sát screenshot pause 844 × 390: phần dưới Resume nằm ngoài viewport đúng như số đo.
- Chrome mobile/touch emulation DPR=3: app 390 × 844 → 844 × 390, đọc renderer và pool hiện có.
- Gọi hàm transform hiện có qua các ngưỡng 430/431, 640/641, ratio 1.35.
- Probe hitbox bằng state core riêng, không dùng hoặc sửa world của ván đang chơi.
- `npm run typecheck`: PASS.
- `npm test -- src/game/core.test.ts src/features/game/render/usePixiApp.test.tsx src/features/game/input/useGamePointerInput.test.tsx`: PASS, 3 file / 6 test.

### Chưa được chứng minh

- Không test iOS Safari, Android WebView/Wink host thật, thanh browser động, safe-area thực, zoom/text scaling hay đổi monitor DPR.
- Không có xác nhận gesture chém/scroll bằng ngón tay trên thiết bị thật. Mobile emulation không thay thế kiểm tra đó.
- Không kiểm tra visual game-over/summary ở mọi viewport, thao tác quảng cáo/revive, âm thanh hoặc production deployment.
- Browser có cảnh báo fallback software WebGL; không dùng lượt này để kết luận hiệu năng GPU/độ mượt thiết bị.
- Không chạy build/deploy vì không thay đổi source. Typecheck và test hiện có không kiểm tra CSS clipping.

### Coverage hiện có còn thiếu

`core.test.ts` mới kiểm tra inverse transform ở desktop letterbox; `usePixiApp.test.tsx` có coalescing resize; `useGamePointerInput.test.tsx` có regression giữ pointer sample qua rerender. Chưa có coverage viewport matrix cho CSS pause/landing, portrait ellipse hitbox, chuyển breakpoint giữa gesture, hoặc config/pool sau rotation.

## 5. Thứ tự xử lý đề xuất sau review

1. R01/R02: bảo đảm các CTA chính vào game và Resume luôn nhìn thấy/tới được ở màn thấp và width 320.
2. R03/R04: chốt contract portrait/world/hitbox và chính sách đổi orientation trong một ván trước khi sửa scale rời rạc.
3. R05/R06: đồng bộ artwork halves và xử lý input/effect khi geometry đổi.
4. R07/R08/R09: thống nhất cấu hình FX, local inset, safe area, viewport tối thiểu và clamp text.
5. Kiểm tra lại trên máy thật: portrait → landscape → portrait, pause/resume, chém sát bomb, iframe/visualViewport đổi size, leaderboard đủ dữ liệu, cả EN/VI.

Không có đề xuất nào trong báo cáo đã được áp dụng vào code.
