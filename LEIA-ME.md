# OZZ Pós-venda: app offline (PWA) — versão 1.0.0

Esta versão guarda as visitas **no próprio aparelho** e funciona sem internet.
A sincronização com a Planilha Google (Apps Script) entra na próxima versão.

## O que tem na pasta

| Arquivo | Para que serve |
|---|---|
| `index.html` | As telas do app |
| `app.js` | A lógica (visitas, painel, exportação, backup) |
| `sw.js` | Guarda o app no aparelho para abrir offline |
| `manifest.webmanifest` | Nome, ícone e cores do app instalado |
| `fonts/`, `lib/`, `icons/` | Fontes, gerador de QR code e ícones, todos embutidos |

## Testar no Mac (rápido, sem publicar)

1. Abra o **Terminal** e vá até a pasta do app:
   `cd ~/Downloads/ozz-posvenda-pwa` (ajuste o caminho se descompactou em outro lugar)
2. Rode: `python3 -m http.server 8000`
3. Abra **http://localhost:8000** no Chrome ou no Safari.
4. Para testar offline: com o app aberto uma vez, desligue o Wi-Fi e recarregue a página.

Para parar o servidor, volte ao Terminal e aperte `Ctrl + C`.

## Publicar (necessário para instalar no iPad)

O iPad só instala o app a partir de um endereço **https**. O jeito mais simples e gratuito:

**Netlify Drop**
1. Acesse **app.netlify.com/drop** e crie uma conta gratuita.
2. Arraste a **pasta inteira** `ozz-posvenda-pwa` para a página.
3. O Netlify dá um endereço, por exemplo `https://ozz-posvenda.netlify.app`. Dá para renomear nas configurações do site.

Outras opções gratuitas que funcionam igual: GitHub Pages e Firebase Hosting.

## Instalar

- **iPad:** abra o endereço no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**.
- **Mac (Safari):** menu **Arquivo → Adicionar ao Dock**. No Chrome: ícone de instalar na barra de endereço.

Depois de instalar, abra o app uma vez com internet. A partir daí ele abre offline.

**Teste final:** no iPad, ative o **modo avião**, abra o app pela Tela de Início e faça uma visita inteira.

## Primeiro uso em cada aparelho

Em **Ajustes**, preencha o link de avaliação do Google e o nome do funcionário.
Os ajustes ficam salvos só naquele aparelho.

## Cuidados importantes

- **Não apague o ícone do app** do iPad: isso apaga as visitas guardadas nele.
  Antes de trocar ou formatar um aparelho, use **Ajustes → Fazer backup**.
- Não use o app numa aba de **navegação privada**.
- Enquanto a sincronização não estiver ligada, cada aparelho vê **só as próprias visitas**.
  Para juntar, use **Exportar planilha** em cada um, ou **Fazer backup** num e **Restaurar backup** no outro.

## Publicar uma versão nova

1. Altere os arquivos.
2. Em `sw.js`, aumente o número em `VERSAO` (ex.: `ozz-posvenda-v1.0.1`).
3. Publique a pasta de novo (no Netlify: aba **Deploys**, arrastar a pasta).

Os aparelhos mostram o aviso "Nova versão do app disponível" com o botão **Atualizar agora**.
