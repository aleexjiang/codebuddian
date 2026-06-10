export interface DiffSegment {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

export interface InlineEditResult {
  original: string;
  modified: string;
  diff: DiffSegment[];
}
