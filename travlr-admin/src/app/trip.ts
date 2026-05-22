export interface Trip {
  _id:            string;
  code:           string;
  name:           string;
  length:         string;
  start:          Date;
  resort:         string;
  perPerson:      number;
  image:          string;
  description:    string;
  category?:      string;
  difficulty?:    string;
  rating?:        number;
  reviewCount?:   number;
  departureCity?: string;
  spotsLeft?:     number;
  includes?:      string[];
}
