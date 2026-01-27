---
title: Proofs of the Fundamental Theorem of Algebra
author: Luca Wellmeier
date: "Jan 26, 2025"
numbered_headings: true
toc: true
abstract: |
  This is just an example page that demonstrates the features of [`gh:lcwllmr/scimd`](https://github.com/lcwllmr/scimd) - a tool for scientific writing with markdown.
macros:
  '\C': '\mathbb{C}'
  '\set': '\left\{#1\;\middle|\;#2\right\}'
---

## Notation and statement

Denote by $\C[z]$ the ring of univariate polynomials with complex coefficients.
Let $p \in \C[z]$ be non-constant of degree $n \geq 1$ with coeficients
$$
   p(z) = a_n z^n + a_{n-1}z^{n-1} + \cdots + a_1 z + a_0
$$
and $a_n \neq 0$.
Then $p$ has a complex root.

![./z2.light.png]
![./z2.dark.png]

## Proofs

### Liouville via a global minimum of $|p|$

Write
$$
   p(z)=a_n z^n\left(1+\frac{a_{n-1}}{a_n}\frac{1}{z}+\cdots+\frac{a_0}{a_n}\frac{1}{z^n}\right).
$$
The bracket tends to $1$ as $|z|\to\infty$, so there exists $R>0$ and $c>0$ such that for $|z|\ge R$,
$$
   |p(z)|\ge c|z|^n \to \infty.
$$

On the closed disk $B_R=\set{z}{|z| \le R}$, the continuous function $z\mapsto |p(z)|$ attains a minimum $m$ by compactness.
For $|z|>R$, $|p(z)|>|p(0)|\ge m$ by taking $R$ large enough, hence this minimum on $B_R$ is also the global minimum on $\C$.
Choose $z_0$ with $|p(z_0)|=m$.

If $m>0$, then $p(z)\neq 0$ for all $z$, hence
$$
   f(z)=\frac{1}{p(z)}
$$
is entire.
Also $|p(z)|\ge m$ for all $z$, so $|f(z)|\le 1/m$: $f$ is bounded.
By [Liouville’s theorem](https://en.wikipedia.org/wiki/Liouville%27s_theorem_(complex_analysis)),
a bounded entire function is constant, so $f$ is constant, hence $p$ is constant - contradiction.
Therefore $m=0$, i.e. $|p(z_0)|=0$, so $p(z_0)=0$.
$\square$
