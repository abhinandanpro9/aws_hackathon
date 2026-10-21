# Made in Masky

The crew's faces and Ava's voice were made with Masky (https://masky.ai).

## Agent portraits

Seven portraits (Ava, Lena, Nora, Theo, Max, Quill and the Director), made with Masky image generation.
Saved as 256x256 PNG in `parent-portal/public/avatars/<id>.png` and `control-panel/public/avatars/<id>.png`.

## Ava's face and voice

- Ava is a Masky avatar with her portrait as the face and a Masky preset voice.
- Her greeting: "Hi, I'm Ava, the front desk at Sunflower Grove. Ask me anything about your child's day."
- The audio is saved as `parent-portal/public/voice/ava.mp3`.
- A lip-synced video of the same line plays on `/demo` in Masky's public player:
  `<iframe src="https://masky.ai/live/t-26-10-vz9d" width="320" height="320" allow="autoplay; fullscreen" style="border:0;border-radius:16px"></iframe>`

## Generating new lines at runtime

Masky's API can turn a new line of text into Ava's voice or a talking video.
The API key stays in a server-side secret (`MASKY_API_KEY`) and is never committed.
See Masky's API docs for the request shape.
