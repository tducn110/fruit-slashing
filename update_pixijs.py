import re

with open('doc/pixijs.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Tailwind rule
content = re.sub(
    r'\* \*\*Rule về CSS/Styles:\*\* \n  \* "Dự án sử dụng inline styles.*?"',
    '* **Rule về CSS/Styles:** \n  * "CSS/CSS Modules dùng cho game-specific UI, overlay, animation và canvas wrapper. Tailwind nếu có thì chỉ dùng cho layout/spacing/typography đơn giản. Không style cùng một property bằng cả Tailwind và CSS module trên cùng element."',
    content,
    flags=re.DOTALL
)

# Add FruitGame rule to "Rule về component structure"
content = re.sub(
    r'\* \*\*Rule về component structure:\*\* \n  \* ".*?"',
    '* **Rule về component structure:** \n  * "Giữ phân tách nghiêm ngặt: UI tĩnh vào `src/components/ui/`, UI đè lên game vào `src/components/game/`, logic render PixiJS vào `src/features/game/render/`. File `core.ts` chỉ chứa logic toán học/vật lý."\n  * "FruitGame chỉ được làm orchestrator: nối core + Pixi hooks + overlay. Không thêm gameplay rule, Firebase, auth, leaderboard hoặc design logic mới vào FruitGame."',
    content,
    flags=re.DOTALL
)

# Extract Project rules at the end
rules_idx = content.find("Project rules for Speed Click Game:")
if rules_idx != -1:
    rules = content[rules_idx:]
    content = content[:rules_idx].strip() + '\n'
    
    with open('doc/ai-rules.md', 'w', encoding='utf-8') as f:
        # Also update the tailwind rule in ai-rules.md
        rules = re.sub(
            r'\* CSS/CSS Modules dùng cho overlay.*$',
            '* CSS/CSS Modules dùng cho game-specific UI, overlay, animation và canvas wrapper. Tailwind nếu có thì chỉ dùng cho layout/spacing/typography đơn giản. Không style cùng một property bằng cả Tailwind và CSS module trên cùng element.',
            rules,
            flags=re.MULTILINE
        )
        f.write("# AI Instructions / Codex Rules\n\n" + rules)

with open('doc/pixijs.md', 'w', encoding='utf-8') as f:
    f.write(content)
