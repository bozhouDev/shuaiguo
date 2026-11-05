// 《迭代需求》局内爽感：台词按角色key轮换，时间用对局物理秒，不消耗玩法随机流。
export const HIT_WINDOW = 10;
export const GRUDGE_TIME = 5;
export const HIT_LINES: Record<string, readonly string[]> = {
  pm: ['这不归财务管！', '我先记一笔', '又是我？'],
  intern: ['哦…好的', '我、我该怎么做', '这也归我吗'],
  veteran: ['呵。', '年轻人火气大', '行，记着'],
  tester: ['我在外面跑客户呢！', '单子还没签呢', '别拿我凑数'],
  designer: ['改第八版了还甩我？', '需求又变了？', '我只是做图的'],
  cashier: ['我就是个出纳！', '这账不对', '别找我'],
  nephew: ['？', '我跟我姐说去', '哎呀'],
};
