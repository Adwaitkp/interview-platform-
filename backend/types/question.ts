export interface IQuestion {
  _id?: string;
  skill: string;
  question: string;
  level: string;
  options: { a: string; b: string; c: string; d: string };
  correctanswer: string;
}