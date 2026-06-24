/*
 * SM-2 间隔重复算法实现
 * 参考: P.A. Wozniak, "SuperMemo 2"
 */

const SM2 = {
  // 初始值
  INITIAL_EF: 2.5,
  INITIAL_INTERVAL: 1,     // 1天
  GRADUATING_INTERVAL: 3,  // 连对3天进入长期记忆
  EASY_BONUS: 1.3,         // 满分时interval乘以这个系数

  /**
   * 根据评分更新学习参数
   * @param {Object} card - { easiness, interval, repetitions, nextReview }
   * @param {number} quality - 0=忘记, 3=模糊, 5=完美
   * @returns {Object} 更新后的 card
   */
  calculate(card, quality) {
    const { easiness, interval, repetitions } = card;
    let newEF = easiness;
    let newInterval;
    let newReps;

    if (quality < 3) {
      // 忘记 → 重置
      newReps = 0;
      newInterval = 0; // 当天再次复习
    } else {
      // 记住了
      if (repetitions === 0) {
        newInterval = 1;
      } else if (repetitions === 1) {
        newInterval = this.GRADUATING_INTERVAL;
      } else {
        newInterval = Math.round(interval * easiness);
      }

      if (quality === 5) {
        newInterval = Math.round(newInterval * this.EASY_BONUS);
      }

      newReps = repetitions + 1;
    }

    // 更新 easiness factor
    newEF = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEF < 1.3) newEF = 1.3;

    const nextReview = this.nextReviewDate(newInterval);

    return {
      easiness: Math.round(newEF * 100) / 100,
      interval: newInterval,
      repetitions: newReps,
      nextReview
    };
  },

  /**
   * 计算下次复习日期
   */
  nextReviewDate(intervalDays) {
    if (intervalDays === 0) {
      // 如果没设置interval，默认现在（立即加入复习队列）
      return new Date().toISOString().split('T')[0];
    }
    const d = new Date();
    d.setDate(d.getDate() + intervalDays);
    return d.toISOString().split('T')[0];
  },

  /**
   * 判断今天是否需要复习
   */
  isDue(nextReviewDate) {
    if (!nextReviewDate) return true;
    const today = new Date().toISOString().split('T')[0];
    return nextReviewDate <= today;
  }
};
