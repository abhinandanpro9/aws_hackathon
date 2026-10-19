# Made in Masky

Account: abhinandan.pro9@gmail.com (free plan). Made 2026-10-19, ~4:25 PM PT.
Everything was made through the Masky API (https://masky.ai/api) with a key named `hackathon-sunflower`, created at https://masky.ai/developer.

## Agent portraits (Masky image generation, default model)

7 images, 0.005 credits each = 0.035 credits. Saved as 256x256 PNG in
`parent-portal/public/avatars/<id>.png` and `control-panel/public/avatars/<id>.png`.

| id | Masky image URL |
|---|---|
| ava | https://firebasestorage.googleapis.com/v0/b/maskydotnet.firebasestorage.app/o/userData%2FmrCVXxEWbOZktAfkSkIh4cQ1cCg2%2Fimages%2Fimg_1792452168609_c08eea7b.jpeg?alt=media&token=3830538778ea7736123398ebf2950564 |
| nora | https://firebasestorage.googleapis.com/v0/b/maskydotnet.firebasestorage.app/o/userData%2FmrCVXxEWbOZktAfkSkIh4cQ1cCg2%2Fimages%2Fimg_1792452169293_0e683c20.jpeg?alt=media&token=5bc870c7d9d9ec1d9115412632286f76 |
| max | https://firebasestorage.googleapis.com/v0/b/maskydotnet.firebasestorage.app/o/userData%2FmrCVXxEWbOZktAfkSkIh4cQ1cCg2%2Fimages%2Fimg_1792452170262_ada4b112.jpeg?alt=media&token=0682b555046038d279a69759a2238476 |
| lena | https://firebasestorage.googleapis.com/v0/b/maskydotnet.firebasestorage.app/o/userData%2FmrCVXxEWbOZktAfkSkIh4cQ1cCg2%2Fimages%2Fimg_1792452168583_6436650e.jpeg?alt=media&token=49a7bfbfbb3f67063b4207a2e0f2add2 |
| theo | https://firebasestorage.googleapis.com/v0/b/maskydotnet.firebasestorage.app/o/userData%2FmrCVXxEWbOZktAfkSkIh4cQ1cCg2%2Fimages%2Fimg_1792452168986_d36e01e1.jpeg?alt=media&token=54e9c4d619d256c7208ae199288b4a09 |
| quill | https://firebasestorage.googleapis.com/v0/b/maskydotnet.firebasestorage.app/o/userData%2FmrCVXxEWbOZktAfkSkIh4cQ1cCg2%2Fimages%2Fimg_1792452168120_03f8f0d0.jpeg?alt=media&token=a58b32cd3c57ed4d34d46b20f772988d |
| director | https://firebasestorage.googleapis.com/v0/b/maskydotnet.firebasestorage.app/o/userData%2FmrCVXxEWbOZktAfkSkIh4cQ1cCg2%2Fimages%2Fimg_1792452168025_e62ba9ef.jpeg?alt=media&token=939841d61e49cf63df142e4cac80cca6 |

## Ava as a Masky avatar (face + voice)

- Avatar: "Ava - Sunflower Grove Front Desk" (avatarId `X3tHCbH5rmPq9SoaS1PM`), face = the Ava portrait above, voice = Masky preset "Warm American Female".
- Conversation: https://masky.ai/c-26-10-furz (private; live player needs the token, owner can view it signed in).
- Voice line, spoken by Ava: "Hi, I'm Ava, the front desk at Sunflower Grove. Ask me anything about your child's day."
  - Clip page: https://masky.ai/t-26-10-li3d · live player: https://masky.ai/live/t-26-10-li3d
  - Saved as `parent-portal/public/voice/ava.mp3` (6.9 s, mp3). Turn cost reported: 0 credits.

## Credits used

About 0.04 credits of the 10 on the account (0.035 for images, voice turn billed at 0 / fractions of a cent). No purchase, no payment details.

## Masky live in the demo (talking Ava)

- Ava's conversation is now PUBLIC: https://masky.ai/live/c-26-10-furz (plays every turn in order).
- Talking-head video turn (lip-synced, same greeting line): player https://masky.ai/live/t-26-10-vz9d · share page https://masky.ai/t-26-10-vz9d
- Masky sends no X-Frame-Options and no CSP frame-ancestors on /live/ pages, so they can be shown in an iframe.
- Embed used on /demo:
  `<iframe src="https://masky.ai/live/t-26-10-vz9d" width="320" height="320" allow="autoplay; fullscreen" style="border:0;border-radius:16px"></iframe>`
- Runtime API (server side only, key stays in an env var `MASKY_API_KEY`, never in the repo):
  `POST https://masky.ai/api/conversations/22Hd1GHvl4OH0jSQhTrh/turn` with header `Authorization: Bearer $MASKY_API_KEY` and body
  `{"userText":"<line, max 500 chars, max 3 sentences>","output":"video","mode":"speak"}` → 202 with `turn.id`.
  Then poll `GET https://masky.ai/api/conversations/by-slug/c-26-10-furz` every 2 s until that turn has `videoUrl` (~60 s) or `audioUrl` (~5 s for `"output":"audio"`). The turn's `liveUrl` (`/live/t-…`) is a ready-made player. The public conversation iframe plays new turns by itself.
  Identical scripted lines are cached by Masky: instant and free.
- Credits: talking-head video billed per second (~$0.025/s); this one reported 0.
