"""
把 src/ 里的原始音频统一转成网页用的 mp3，放到 ../assets/audio/，并生成 ../js/audio.js（音频 id → 地址和时长）。
用法：python3 build_audio.py        （改了 sources.json 或 src/ 里的文件后运行；需要本机装 ffmpeg）
素材清单和来源授权都记在 sources.json：src 是原始文件名，skip 写了原因的条目不打包，没有 src 的条目游戏里退回合成音。
加工规则：
  - BGM：两遍 loudnorm 统一响度（-18 LUFS），立体声 96 kbps，不裁剪，保证循环接缝不变。
  - 短曲 / 音效：去掉开头的静音（按下就响），峰值统一到 -1 dB，单声道 64 kbps。
"""
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, '..', 'assets', 'audio')
JS = os.path.join(ROOT, '..', 'js', 'audio.js')
BGM_LUFS = -18   # BGM 目标响度
PEAK_DB = -1.0   # 音效目标峰值


def ff(args):
    """跑一次 ffmpeg，返回 stderr（测量结果都在 stderr 里）。出错直接退出。"""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y'] + args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(r.stderr[-2000:])
    return r.stderr


def duration(path):
    """读音频时长（秒）。"""
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    return round(float(r.stdout.strip()), 3)


def build_bgm(src, dst):
    """BGM：第一遍测响度，第二遍按测量值线性调整，避免动态压缩改变循环首尾。"""
    log = ff(['-i', src, '-af', f'loudnorm=I={BGM_LUFS}:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    m = json.loads(log[log.rindex('{'):log.rindex('}') + 1])
    af = (f"loudnorm=I={BGM_LUFS}:TP=-1.5:LRA=11:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
          f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    ff(['-i', src, '-af', af, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '96k', dst])


def build_sfx(src, dst, item):
    """短曲 / 音效：去开头静音 → 可选截取和淡出 → 峰值归一 → 单声道 mp3。"""
    chain = ['silenceremove=start_periods=1:start_threshold=-50dB']
    if item.get('trim'):
        chain.append(f"atrim=0:{item['trim']}")
    if item.get('fade'):
        start = item['trim'] - item['fade'] if item.get('trim') else 0
        chain.append(f"afade=t=out:st={start}:d={item['fade']}")
    pre = ','.join(chain)
    log = ff(['-i', src, '-af', pre + ',volumedetect', '-f', 'null', '-'])
    peak = float(re.search(r'max_volume: ([-\d.]+) dB', log).group(1))
    gain = PEAK_DB - peak
    ff(['-i', src, '-af', f'{pre},volume={gain}dB', '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', dst])


def main():
    items = json.load(open(os.path.join(ROOT, 'sources.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    manifest, used = {}, set()
    for it in items:
        if it.get('skip') or not it.get('src'):
            continue
        src = os.path.join(SRC, it['src'])
        if not os.path.exists(src):
            print(f"缺原始文件，跳过：{it['id']}（{it['src']}）")
            continue
        dst = os.path.join(OUT, it['id'] + '.mp3')
        (build_bgm if it['kind'] == 'bgm' else lambda s, d: build_sfx(s, d, it))(src, dst)
        h = hashlib.md5(open(dst, 'rb').read()).hexdigest()[:8]
        manifest[it['id']] = {'url': f"assets/audio/{it['id']}.mp3?v={h}", 'dur': duration(dst)}
        used.add(it['id'] + '.mp3')
        print(f"{it['id']:<18} {os.path.getsize(dst) / 1024:7.1f} KB  {manifest[it['id']]['dur']:.2f}s")
    # 清掉清单里已经不用的旧文件
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f not in used:
            os.remove(os.path.join(OUT, f))
    with open(JS, 'w', encoding='utf-8') as fp:
        fp.write('/* 由 assets_audio/build_audio.py 自动生成，不要手改。音频 id → 地址（带内容哈希）和时长（秒）；'
                 '没登记的 id 游戏里退回 WebAudio 合成音 */\n')
        fp.write('window.SG_AUDIO = ' + json.dumps(manifest, separators=(',', ':')) + ';\n')
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in used)
    print(f'共 {len(manifest)} 个，{total / 1024 / 1024:.2f} MB → assets/audio/，清单 → js/audio.js')


if __name__ == '__main__':
    main()
