name: anime-bot

# 🔥 PERMISOS PARA HACER PUSH
permissions:
  contents: write

on:
  workflow_dispatch:
  schedule:
    - cron: '0 */3 * * *'

jobs:
  run-bot:
    runs-on: ubuntu-latest

    steps:
      # ======================
      # 🟢 CLONAR REPO
      # ======================
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: main

      # ======================
      # 🟢 DEBUG (MUY ÚTIL)
      # ======================
      - name: Debug repo
        run: |
          echo "===== ROOT ====="
          pwd
          ls -la
          echo "===== TREE ====="
          ls -R

      # ======================
      # 🟢 NODE
      # ======================
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      # ======================
      # 🟢 CREAR ENTORNO
      # ======================
      - name: Init project
        run: |
          npm init -y
          npm pkg set type=module

      # ======================
      # 🟢 DEPENDENCIAS
      # ======================
      - name: Install dependencies
        run: npm install node-fetch@3

      # ======================
      # 🟢 VERIFICAR BOT
      # ======================
      - name: Check bot exists
        run: |
          if [ ! -f "bot.js" ]; then
            echo "❌ bot.js NO EXISTE EN ROOT"
            exit 1
          else
            echo "✅ bot.js encontrado"
          fi

      # ======================
      # 🟢 EJECUTAR BOT (CON API KEY)
      # ======================
      - name: Run bot
        run: node ./bot.js
        env:
          API_KEY: ${{ secrets.API_KEY }}

      # ======================
      # 🟢 GUARDAR CACHE
      # ======================
      - name: Commit changes
        run: |
          git config --global user.name "anime-bot"
          git config --global user.email "bot@anime.com"
          git add .
          git commit -m "update cache" || echo "no changes"
          git push
