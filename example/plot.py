import numpy as np
import matplotlib.pyplot as plt


R = 1.2
A = np.linspace(-0.5, 0.5, 100)
B = np.linspace(-1.5, 1.5, 100)
A, B = np.meshgrid(A, B)
Z = A + 1j * B
F = np.abs(1 + Z**2)

def plot(mode):
    if mode == 'dark':
        plt.style.use('dark_background')
    elif mode == 'light':
        plt.style.use('default')
    else:
        assert False
        
    fig, ax = plt.subplots(subplot_kw={"projection": "3d"})
    fig.set_size_inches((7, 6))
    ax.set_title("$f(z) = |1 + z^2|$")
    ax.plot_surface(A, B, F, rstride=2, cstride=2)
    ax.set(xticklabels=[],
           yticklabels=[],
           zticklabels=[])
    fig.savefig(f"z2.{mode}.png", transparent=True)
    plt.close()

plot("light")
plot("dark")
