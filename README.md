# Поляра на крива на Безие и Blossom 

## 1. Крива на Безие

Кривата на Безие от степен **n** с контролни точки **b₀, b₁, ..., bₙ** се дефинира чрез линейна комбинация на **Bernstein полиномите**:

<img src="https://latex.codecogs.com/svg.image?\large&space;\bg{white}\mathbf{B}(t)=\sum_{i=0}^{n}b_i&space;B_i^n(t)">

където:

- <img src="https://latex.codecogs.com/svg.image?\bg{white}\mathbf{B}(t)"> е кривата,
- <img src="https://latex.codecogs.com/svg.image?\bg{white}B_i^n(t)=\binom{n}{i}(1-t)^{n-i}t^i"> са Bernstein базисите,
- <img src="https://latex.codecogs.com/svg.image?\bg{white}b_i"> са контролните точки.

## 2. Blossom

**Blossom** е мултилинейна и симетрична функция:

<img src="https://latex.codecogs.com/svg.image?\large&space;\bg{white}\mathbf{b}(t_1,&space;t_2,&space;\dots,&space;t_n)">

която удовлетворява:

<img src="https://latex.codecogs.com/svg.image?\large&space;\bg{white}\mathbf{b}(t,&space;t,&space;\dots,&space;t)&space;=&space;\mathbf{B}(t)">

Свойства на blossom:

- Симетричност: не зависи от реда на аргументите.
- Мултилинейност: линейна по всеки аргумент.
- Диагонално свойство: възстановява оригиналната крива при <img src="https://latex.codecogs.com/svg.image?t_1=t_2=\dots=t_n=t">.

## 3. Полярна форма (Polar Form)

Полярната форма на кривата на Безие е именно **blossom** — тя е единствената мултилинейна симетрична функция <img src="https://latex.codecogs.com/svg.image?\bg{white}\mathbf{b}(t_1,\dots,t_n)">, която възстановява кривата:

<img src="https://latex.codecogs.com/svg.image?\large&space;\bg{white}\mathbf{B}(t)&space;=&space;\mathbf{b}(t,&space;t,&space;\dots,&space;t)">

## 4. Алгоритъм на де Кастелжо (de Casteljau)

Blossom е в основата на **алгоритъма на де Кастелжо**, който изчислява стойности на кривата на Безие чрез итеративна линейна интерполация:

<img src="https://latex.codecogs.com/svg.image?\large&space;\bg{white}\mathbf{b}_i^{(r)}(t)&space;=&space;(1&space;-&space;t)\mathbf{b}_i^{(r-1)}(t)&space;&plus;&space;t\mathbf{b}_{i&plus;1}^{(r-1)}(t)">

Крайната стойност на кривата:

<img src="https://latex.codecogs.com/svg.image?\large&space;\bg{white}\mathbf{B}(t)&space;=&space;\mathbf{b}_0^{(n)}(t)">

## 5. Производна чрез blossom

Производната на Безие крива се изразява с контролни точки:

<img src="https://latex.codecogs.com/svg.image?\large&space;\bg{white}\mathbf{B}'(t)&space;=&space;n\sum_{i=0}^{n-1}(b_{i&plus;1}&space;-&space;b_i)&space;B_i^{n-1}(t)">

## 6. Blossom и Полярна форма (геометрична интерпретация)

След първата стъпка от алгоритъма на де Кастелжо, с параметър `t_i`, получените точки:

<img src="https://latex.codecogs.com/svg.image?\bg{white}b_0^{(1)}(t_i),&space;b_1^{(1)}(t_i),&space;\dots,&space;b_{n-1}^{(1)}(t_i)">

могат да се интерпретират като контролен многоъгълник на нова крива `p₁(t)` със степен `n − 1`.

Чрез **blossoming** (процесът на прилагане на `n` последователни стъпки от алгоритъма на **де Кастелжо**, но всяка с отделен параметър), тази крива се описва така:

<img src="https://latex.codecogs.com/svg.image?\bg{white}p_1(t)&space;=&space;b(t)&space;&plus;&space;\frac{t_i&space;-&space;t}{n}&space;\cdot&space;\frac{d}{dt}b(t)">

Този полином `p₁` се нарича **първа поляра** (*first polar*) на `b(t)` по отношение на `t_i`.

---

Източник: *Curves and Surfaces for CAGD*, Gerald Farin, 5th Edition
