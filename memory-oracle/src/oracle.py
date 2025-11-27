import sys

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        n = int(sys.argv[1])
        print(factorial(n))
    else:
        print(1)

