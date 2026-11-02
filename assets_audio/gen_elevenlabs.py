"""
用 ElevenLabs 音效接口生成 sources.json 里带 gen 字段、还没有原始文件的条目。
用法：python3 gen_elevenlabs.py [id ...] [--n 2] [--force]
  - 不写 id：生成所有带 gen、还没有 src 的条目；写了 id 只生成这几个。
  - --n：每条生成几个版本（默认 2），文件名 src/<id>__v1.mp3、__v2.mp3…；第 1 版自动登记为 src，想换哪版改 sources.json。
  - --force：已经有 src 的也重新生成。
Key 从环境变量 ELEVENLABS_API_KEY 读，不要写进代码或提交记录。生成完记得跑 build_audio.py。
"""
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
SOURCES = os.path.join(ROOT, 'sources.json')
API = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128'
MODEL = 'eleven_text_to_sound_v2'
# 所有提示词共用的风格后缀：和游戏的 16-bit 像素风、搞笑办公室题材保持一致
STYLE = ', retro 16-bit video game style, clean, no music unless stated, no voice'


def generate(key, gen):
    """调一次接口，返回 mp3 二进制。loop 为 True 时让接口生成可无缝循环的音频。"""
    body = {'text': gen['prompt'] + STYLE, 'duration_seconds': gen['duration'],
            'prompt_influence': 0.5, 'model_id': MODEL}
    if gen.get('loop'):
        body['loop'] = True
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method='POST',
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main():
    args = sys.argv[1:]
    n = int(args[args.index('--n') + 1]) if '--n' in args else 2
    force = '--force' in args
    only = {a for a in args if not a.startswith('--') and not a.isdigit()}
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        sys.exit('没有读到环境变量 ELEVENLABS_API_KEY')
    items = json.load(open(SOURCES, encoding='utf-8'))
    todo = [it for it in items if it.get('gen') and (it['id'] in only if only else force or not it.get('src'))]
    for it in todo:
        for v in range(1, n + 1):
            name = f"{it['id']}__v{v}.mp3"
            try:
                data = generate(key, it['gen'])
            except urllib.error.HTTPError as e:
                sys.exit(f"{it['id']} 生成失败：HTTP {e.code} {e.read()[:300].decode(errors='ignore')}")
            open(os.path.join(SRC, name), 'wb').write(data)
            print(f'{name}  {len(data) / 1024:.1f} KB')
        # 第 1 版登记为正式来源；授权按 ElevenLabs 付费账号的商用条款
        it.update({'src': f"{it['id']}__v1.mp3", 'license': 'ElevenLabs 生成（付费账号可商用）',
                   'author': 'ElevenLabs ' + MODEL, 'source_url': None})
    json.dump(items, open(SOURCES, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'生成 {len(todo)} 条，接着跑 python3 build_audio.py')


if __name__ == '__main__':
    main()
